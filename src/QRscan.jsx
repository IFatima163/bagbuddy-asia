import { useEffect, useState } from "react";

export default function ScanForm() {
  const [dateScanned, setDateScanned] = useState("");
  const [timeScanned, setTimeScanned] = useState("");
  const [form, setForm] = useState({
    your_name: "",
    shop_name: "",
    booking_id: "",
    service_type: "Luggage pick up"
  });

  useEffect(() => {
    const now = new Date();
    setDateScanned(now.toISOString().split("T")[0]);
    setTimeScanned(now.toTimeString().split(" ")[0]);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      date_scanned: dateScanned,
      time_scanned: timeScanned,
      ...form
    };

    await fetch("/wp-json/bagbuddy/v1/logScan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    alert("Scan recorded");
  };

  return (
    <form onSubmit={handleSubmit}>
      <p>Date scanned: {dateScanned}</p>
      <p>Time scanned: {timeScanned}</p>

      <input
        type="text"
        placeholder="Your name"
        value={form.your_name}
        onChange={(e) => setForm({ ...form, your_name: e.target.value })}
        required
      />

      <input
        type="text"
        placeholder="Shop name"
        value={form.shop_name}
        onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
        required
      />

      <input
        type="text"
        placeholder="Booking ID"
        value={form.booking_id}
        onChange={(e) => setForm({ ...form, booking_id: e.target.value })}
        required
      />

      <select
        value={form.service_type}
        onChange={(e) => setForm({ ...form, service_type: e.target.value })}
      >
        <option>Luggage pick up</option>
        <option>Luggage drop off</option>
      </select>

      <button type="submit">Submit</button>
    </form>
  );
}
