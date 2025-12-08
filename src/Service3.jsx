import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Helpers
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = v => v * Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const luggageToLargeEquivalent = ({ small, medium, large, xlarge }) => {
  const small_equiv_large = (small || 0) / 2;
  const medium_equiv_large = ((medium || 0) * 2) / 3;
  return (large || 0) + (xlarge || 0) + small_equiv_large + medium_equiv_large;
};

const CAR_CAPACITY = {
  small: { large: 3 },
  medium: { large: 4, medium: 1 },
  large: { large: 6 }
};

const inferCar = (counts) => {
  const eq = luggageToLargeEquivalent(counts);
  if (eq <= CAR_CAPACITY.small.large) return 'small';
  const medium_cap_large = CAR_CAPACITY.medium.large + (CAR_CAPACITY.medium.medium * (2/3));
  if (eq <= medium_cap_large) return 'medium';
  return 'large';
};

const PRICES = {
  self: { small:15, medium:20, large:25, xlarge:30 }
};

// Nominatim search
const nominatimSearch = async (q, setResults) => {
  if(!q || q.length < 2) { setResults([]); return; }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`;
  try{
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }});
    const json = await r.json();
    setResults(json);
  } catch(e){ console.error(e); setResults([]); }
};

// Save frequent search
const saveFrequentSearch = async (city, item) => {
  try{
    await fetch(`${window.BagBuddyConfig.root}/save_search`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json','X-WP-Nonce': window.BagBuddyConfig.nonce },
      body: JSON.stringify({
        city,
        place_name: item.display_name,
        lat: item.lat,
        lng: item.lon
      })
    });
  }catch(e){ /* ignore */ }
};

function Service3() {
  const [city, setCity] = useState('Kuala Lumpur');
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [pickupLatLng, setPickupLatLng] = useState(null);
  const [dropLatLng, setDropLatLng] = useState(null);
  const [pickupDt, setPickupDt] = useState('');
  const [dropDt, setDropDt] = useState('');
  const [luggage, setLuggage] = useState({ small:0, medium:0, large:0, xlarge:0 });
  const [carSize, setCarSize] = useState('none');
  const [price, setPrice] = useState(0);
  const [errors, setErrors] = useState([]);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);

  // price + car inference
  useEffect(()=> {
    let total = 0;
    total += (luggage.small||0) * PRICES.self.small;
    total += (luggage.medium||0) * PRICES.self.medium;
    total += (luggage.large||0) * PRICES.self.large;
    total += (luggage.xlarge||0) * PRICES.self.xlarge;

    setPrice(total);
    setCarSize(inferCar(luggage));
  }, [luggage]);

  const inc = size => setLuggage(l => ({...l, [size]: (l[size]||0) + 1}));
  const dec = size => setLuggage(l => ({...l, [size]: Math.max(0,(l[size]||0)-1)}));

  const onSelectPickup = (item) => {
    setPickupQuery(item.display_name);
    setPickupLatLng({lat:parseFloat(item.lat),lng:parseFloat(item.lon)});
    setPickupSuggestions([]);
    saveFrequentSearch(city, item);
  };

  const onSelectDrop = (item) => {
    setDropQuery(item.display_name);
    setDropLatLng({lat:parseFloat(item.lat),lng:parseFloat(item.lon)});
    setDropSuggestions([]);
    saveFrequentSearch(city, item);
  };

  // validation
  const clientValidate = () => {
    const errs = [];
    if(!pickupLatLng) errs.push('pickup_location_required');
    if(!dropLatLng) errs.push('drop_location_required');
    if(!pickupDt) errs.push('pickup_datetime_required');
    if(!dropDt) errs.push('dropoff_datetime_required');

    const now = new Date();
    const p = new Date(pickupDt);
    const d = new Date(dropDt);
    if(p.toString()==='Invalid Date' || d.toString()==='Invalid Date') errs.push('invalid_datetime');
    if(p < now) errs.push('pickup_in_past');
    if(d <= p) errs.push('drop_must_be_after_pickup');

    if(pickupLatLng && dropLatLng){
      const dist = haversineKm(pickupLatLng.lat,pickupLatLng.lng,dropLatLng.lat,dropLatLng.lng);
      if(dist > 10) errs.push('distance_exceeded');
    }

    setErrors(errs);
    return errs.length===0;
  };

  // WooCommerce add to cart
  const onAddToCart = async () => {
    if(!clientValidate()) return;

    const payload = {
      pickup_lat: pickupLatLng.lat,
      pickup_lng: pickupLatLng.lng,
      drop_lat: dropLatLng.lat,
      drop_lng: dropLatLng.lng,
      pickup_datetime: pickupDt,
      dropoff_datetime: dropDt,
      luggage
    };

    const res = await fetch(`${window.BagBuddyConfig.root}/validate_booking`, {
      method:'POST',
      headers:{'Content-Type':'application/json','X-WP-Nonce':window.BagBuddyConfig.nonce},
      body: JSON.stringify(payload)
    });

    const srv = await res.json();
    if(!srv.valid){
      setErrors([srv.reason || 'server_invalid']);
      return;
    }

    const formData = new FormData();
    formData.append('product_id', BagBuddyConfig.products.service3);
    formData.append('quantity', 1);
    formData.append('price_override', srv.price_total);
    formData.append('addons[city]', city);
    formData.append('addons[pickup]', pickupQuery);
    formData.append('addons[drop]', dropQuery);
    formData.append('addons[pickup_datetime]', pickupDt);
    formData.append('addons[dropoff_datetime]', dropDt);
    formData.append('addons[luggage]', JSON.stringify(luggage));

    try{
      const response = await fetch('/?wc-ajax=add_to_cart',{method:'POST',body:formData});
      const data = await response.json();
      if(data.error) alert("Failed to add to cart: "+data.error);
      else alert("Service 3 added to cart!");
    } catch(e){ console.error(e); alert("Error adding to cart"); }
  };

  return (
    <div className="bagbuddy-ui p-4 max-w-3xl">
      <h2>Service 3 Booking</h2>

      <div>
        <label>City</label>
        <select value={city} onChange={e=>setCity(e.target.value)}>
          {Object.keys(window.BagBuddyConfig.cities_airports).map(c=><option key={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label>Pickup Location</label>
        <input
          value={pickupQuery}
          onChange={e=>{setPickupQuery(e.target.value); nominatimSearch(e.target.value,setPickupSuggestions);}}
          placeholder="Start typing address or shop"
        />
        <div className="suggestions">
          {pickupSuggestions.map(s=><div key={s.place_id} onClick={()=>onSelectPickup(s)}>{s.display_name}</div>)}
        </div>
      </div>

      <div>
        <label>Drop-off Location</label>
        <input
          value={dropQuery}
          onChange={e=>{setDropQuery(e.target.value); nominatimSearch(e.target.value,setDropSuggestions);}}
          placeholder="Start typing address or shop"
        />
        <div className="suggestions">
          {dropSuggestions.map(s=><div key={s.place_id} onClick={()=>onSelectDrop(s)}>{s.display_name}</div>)}
        </div>
      </div>

      <div>
        <label>Pickup Date & Time</label>
        <input type="datetime-local" value={pickupDt} onChange={e=>setPickupDt(e.target.value)} />
      </div>

      <div>
        <label>Drop-off Date & Time</label>
        <input type="datetime-local" value={dropDt} onChange={e=>setDropDt(e.target.value)} />
      </div>

      <div>
        <h3>Luggage</h3>
        {['small','medium','large','xlarge'].map(size=>(
          <div key={size}>
            <span>{size}</span>
            <button type="button" onClick={()=>dec(size)}>-</button>
            <span>{luggage[size]}</span>
            <button type="button" onClick={()=>inc(size)}>+</button>
          </div>
        ))}
      </div>

      <div>
        <h3>Car (auto-selected based on luggage)</h3>
        <div>{carSize}</div>
      </div>

      <div>Total: RM {price.toFixed(2)}</div>

      <div>
        <button className="bagbuddy-add-to-cart" onClick={onAddToCart}>Add to Cart</button>
      </div>

      <div className="text-red-600">
        {errors.map(e=><div key={e}>{e}</div>)}
      </div>
    </div>
  );
}

// Mount Service 3
document.addEventListener('DOMContentLoaded', function(){
  const root = document.getElementById('bagbuddy-service3');
  if(root) createRoot(root).render(<Service3 />);
});

export default Service3;
