import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Helpers
const haversineKm = (lat1,lon1,lat2,lon2) => {
  const R = 6371;
  const toRad = v => v * Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// conversion / car logic from your rules
const luggageToLargeEquivalent = ({ small, regular, large, xl }) => {
  // 1 large = 2 small
  // 2 large = 3 medium -> 1 medium = 2/3 large
  const small_equiv_large = (small || 0) / 2;
  const medium_equiv_large = ((regular || 0) * 2) / 3;
  return (large || 0) + (xl || 0) + small_equiv_large + medium_equiv_large;
};

const CAR_CAPACITY = {
  small: { large: 3 },
  medium: { large: 4, medium: 1 },
  large: { large: 6 }
};

const inferCar = (counts) => {
  const eq = luggageToLargeEquivalent(counts);
  if (eq <= CAR_CAPACITY.small.large) return 'small';
  // compute medium capacity in large-equivalent
  const medium_cap_large = CAR_CAPACITY.medium.large + (CAR_CAPACITY.medium.medium * (2/3));
  if (eq <= medium_cap_large) return 'medium';
  return 'large';
};

const PRICES = {
  self: { small:15, regular:20, large:25, xl:30 },
  doorUpsell: 15,
  airportUpsell: 60
};

function App(){
  // form state
  const [city, setCity] = useState('Kuala Lumpur');
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [pickupLatLng, setPickupLatLng] = useState(null);
  const [dropLatLng, setDropLatLng] = useState(null);
  const [pickupDt, setPickupDt] = useState('');
  const [dropDt, setDropDt] = useState('');
  const [luggage, setLuggage] = useState({ small:0, regular:0, large:0, xl:0 });
  const [upsell, setUpsell] = useState('none'); // 'airport' | 'door' | 'none'
  const [airportChoice, setAirportChoice] = useState(null);
  const [availableAirports, setAvailableAirports] = useState([]);
  const [carSize, setCarSize] = useState('none');
  const [price, setPrice] = useState(0);
  const [errors, setErrors] = useState([]);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);

  useEffect(()=> {
    // set airports from localized BagBuddyConfig if present
    if(window.BagBuddyConfig && window.BagBuddyConfig.cities_airports){
      setAvailableAirports(window.BagBuddyConfig.cities_airports[city] || []);
      if((window.BagBuddyConfig.cities_airports[city] || []).length === 1){
        setAirportChoice((window.BagBuddyConfig.cities_airports[city] || [])[0]);
      }
    }
  }, [city]);

  // price calc
  useEffect(()=> {
    let total = 0;
    total += (luggage.small||0) * PRICES.self.small;
    total += (luggage.regular||0) * PRICES.self.regular;
    total += (luggage.large||0) * PRICES.self.large;
    total += (luggage.xl||0) * PRICES.self.xl;
    if(upsell === 'airport') total += PRICES.airportUpsell;
    if(upsell === 'door') total += PRICES.doorUpsell;
    setPrice(total);
    // auto determine car
    const inferred = inferCar({ small: luggage.small, regular: luggage.regular, large: luggage.large, xl: luggage.xl });
    setCarSize(inferred);
  }, [luggage, upsell]);

  // Autocomplete with Nominatim
  const nominatimSearch = async (q, setResults) => {
    if(!q || q.length < 2) { setResults([]); return; }
    // Use format=jsonv2 to get lat/lon
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`;
    try{
      const r = await fetch(url, { headers: { 'Accept': 'application/json' }});
      const json = await r.json();
      setResults(json);
    } catch(e){
      console.error(e);
      setResults([]);
    }
  };

  // pick suggestion selected
  const onSelectPickup = (item) => {
    setPickupQuery(item.display_name);
    setPickupLatLng({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setPickupSuggestions([]);
    // record frequent search
    saveFrequentSearch(item);
  };
  const onSelectDrop = (item) => {
    setDropQuery(item.display_name);
    setDropLatLng({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setDropSuggestions([]);
    saveFrequentSearch(item);
  };

  const saveFrequentSearch = async (item) => {
    // send to server to upsert frequent searches
    try{
      await fetch(`${window.BagBuddyConfig.root}/save_search`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'X-WP-Nonce': window.BagBuddyConfig.nonce },
        body: JSON.stringify({
          city,
          place_name: item.display_name,
          lat: item.lat,
          lng: item.lon
        })
      });
    }catch(e){ /* ignore */ }
  };

  // luggage controls
  const inc = (size) => setLuggage(l => ({...l, [size]: (l[size]||0) + 1}));
  const dec = (size) => setLuggage(l => ({...l, [size]: Math.max(0, (l[size]||0) - 1)}));

  // client-side validate before server validation
  const clientValidate = () => {
    const errs = [];
    if(!pickupLatLng) errs.push('pickup_location_required');
    if(!dropLatLng) errs.push('drop_location_required');
    if(!pickupDt) errs.push('pickup_datetime_required');
    if(!dropDt) errs.push('dropoff_datetime_required');
    // no past
    const now = new Date();
    const p = new Date(pickupDt);
    const d = new Date(dropDt);
    if(p.toString() === 'Invalid Date' || d.toString() === 'Invalid Date') errs.push('invalid_datetime');
    if(p < now) errs.push('pickup_in_past');
    if(d <= p) errs.push('drop_must_be_after_pickup');

    // distance check client-side
    if(pickupLatLng && dropLatLng){
      const dist = haversineKm(pickupLatLng.lat,pickupLatLng.lng,dropLatLng.lat,dropLatLng.lng);
      if(dist > 10) errs.push('distance_exceeded');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  // Server validate via REST
  const serverValidate = async () => {
    const payload = {
      pickup_lat: pickupLatLng.lat,
      pickup_lng: pickupLatLng.lng,
      drop_lat: dropLatLng.lat,
      drop_lng: dropLatLng.lng,
      pickup_datetime: pickupDt,
      dropoff_datetime: dropDt,
      luggage: {
        small: luggage.small, regular: luggage.regular, large: luggage.large, xl: luggage.xl
      },
      upsell
    };
    const res = await fetch(`${window.BagBuddyConfig.root}/validate_booking`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-WP-Nonce': window.BagBuddyConfig.nonce },
      body: JSON.stringify(payload)
    });
    return res.json();
  };

  // Add to cart placeholder (we'll wire to WooCommerce in Step 5)
  const onAddToCart = async () => {
    if(!clientValidate()) return;
    const srv = await serverValidate();
    if(!srv.valid){
      setErrors([srv.reason || 'server_invalid']);
      return;
    }
    alert('Validated. (Placeholder) Add to Cart logic to be implemented in Step 5. Price total: RM ' + srv.price_total);
    // You should call a server endpoint that adds a WC cart item with booking meta.
  };

  return (
    <div className="bagbuddy-ui p-4 max-w-3xl">
      <h2>Self pick-up & drop-off</h2>

      <div className="mb-3">
        <label>City</label>
        <select value={city} onChange={(e)=>setCity(e.target.value)}>
          {Object.keys(window.BagBuddyConfig.cities_airports).map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>Pickup location</label>
          <input value={pickupQuery} onChange={e=>{ setPickupQuery(e.target.value); nominatimSearch(e.target.value, setPickupSuggestions); }} placeholder="Start typing address or shop" />
          <div className="suggestions">
            {pickupSuggestions.map(s => <div key={s.place_id} onClick={()=>onSelectPickup(s)} style={{cursor:'pointer'}}>{s.display_name}</div>)}
          </div>
        </div>
        <div>
          <label>Drop-off location</label>
          <input value={dropQuery} onChange={e=>{ setDropQuery(e.target.value); nominatimSearch(e.target.value, setDropSuggestions); }} placeholder="Start typing address or shop" />
          <div className="suggestions">
            {dropSuggestions.map(s => <div key={s.place_id} onClick={()=>onSelectDrop(s)} style={{cursor:'pointer'}}>{s.display_name}</div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label>Pickup date & time</label>
          <input type="datetime-local" value={pickupDt} onChange={e=>setPickupDt(e.target.value)} />
        </div>
        <div>
          <label>Drop-off date & time</label>
          <input type="datetime-local" value={dropDt} onChange={e=>setDropDt(e.target.value)} />
        </div>
      </div>

      <div className="mt-4">
        <label>Luggage</label>
        <div className="grid grid-cols-4 gap-2">
          {['small','regular','large','xl'].map(size => (
            <div key={size} className="p-2 border">
              <div className="text-sm">{size}</div>
              <div className="mt-2">
                <button onClick={()=>dec(size)}>-</button>
                <span className="mx-2">{luggage[size]||0}</span>
                <button onClick={()=>inc(size)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label>Upsell (only one)</label>
        <div>
          <label><input type="radio" checked={upsell==='none'} onChange={()=>setUpsell('none')}/> None</label>
          <label className="ml-3"><input type="radio" checked={upsell==='airport'} onChange={()=>setUpsell('airport')}/> Airport pickup/drop (+RM60)</label>
          <label className="ml-3"><input type="radio" checked={upsell==='door'} onChange={()=>setUpsell('door')}/> Door-to-door within 10km (+RM15)</label>
        </div>
      </div>

      {upsell === 'airport' && (
        <div className="mt-3">
          <label>Airport</label>
          <select value={airportChoice || ''} onChange={e=>setAirportChoice(e.target.value)}>
            <option value=''>Select airport</option>
            {availableAirports.map(a=> <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="mt-2">Car automatically locked by luggage (inferred: {carSize})</div>
        </div>
      )}

      {upsell === 'door' && (
        <div className="mt-3">
          <label>Door service location (within 10km of pickup)</label>
          <input placeholder="Hotel or address" />
          <div className="mt-2">With passenger? <input type="checkbox" /></div>
        </div>
      )}

      <div className="mt-4">
        <strong>Total: RM {price.toFixed(2)}</strong>
      </div>

      <div className="mt-4">
        <button onClick={onAddToCart}>Add to cart</button>
        <button className="ml-3">Checkout</button>
      </div>

      <div className="mt-4 text-red-600">
        {errors.map(e => <div key={e}>{e}</div>)}
      </div>
    </div>
  );
}

// Mount on the page
document.addEventListener('DOMContentLoaded', function(){
  const root = document.getElementById('bagbuddy-service1');
  if(root){
    createRoot(root).render(<App />);
  }
});

export default App;
