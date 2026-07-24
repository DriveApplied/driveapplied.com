const NAME_KEY = "williamsburg-traveler-name";

const events = [
  ["2026-07-24T08:45:00-04:00", "The Williamsburg adventure begins", "Friday · July 24", "Depart New Jersey", "Load up, settle in, and keep arrival day easy."],
  ["2026-07-25T10:00:00-04:00", "Explore Colonial Williamsburg", "Saturday · July 25", "Duke of Gloucester Street", "Capitol, Palace grounds, shops, and demonstrations."],
  ["2026-07-25T19:15:00-04:00", "Dinner at King’s Arms Tavern", "Saturday · July 25", "Colonial Williamsburg", "The signature dinner of the trip, followed by a lantern-lit walk."],
  ["2026-07-27T09:30:00-04:00", "Jamestown day", "Monday · July 27", "Jamestown Settlement", "Add Historic Jamestowne if everyone wants more history."],
  ["2026-07-27T17:15:00-04:00", "Dinner at Sweet Tea & Barley", "Monday · July 27", "Williamsburg", "An easy early meal after returning to the resort."],
  ["2026-07-28T09:30:00-04:00", "Busch Gardens, day one", "Tuesday · July 28", "Busch Gardens Williamsburg", "Arrive before opening and leave while everyone still has energy."],
  ["2026-07-28T18:45:00-04:00", "Dinner at Christiana Campbell’s", "Tuesday · July 28", "Colonial Williamsburg", "Rest at the hotel first, then return for dinner and the west end."],
  ["2026-07-29T10:00:00-04:00", "Busch Gardens, part two", "Wednesday · July 29", "Busch Gardens Williamsburg", "Repeat favorites, catch the shows, and stay later."],
  ["2026-07-31T09:00:00-04:00", "Breakfast, pack, and head home", "Friday · July 31", "Marriott’s Manor Club", "One last slow morning before pointing north."]
].map(([at, title, day, location, note]) => ({ date: new Date(at), title, day, location, note }));

const gate = document.querySelector("#nameGate");
const form = document.querySelector("#nameForm");
const nameInput = document.querySelector("#travelerName");

function setName(name) {
  document.querySelector("#pageTitle").textContent = name ? `${name}’s Williamsburg Adventure` : "Williamsburg Adventure";
  gate.hidden = Boolean(name);
}

function update() {
  const now = new Date();
  const next = events.find((event) => event.date > now) || events.at(-1);
  const remaining = Math.max(0, next.date - now);
  document.querySelector("#localClock").textContent = `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }).format(now)} EDT`;
  document.querySelector("#eventTitle").textContent = next.title;
  document.querySelector("#eventMeta").textContent = `${next.day} · ${next.location}`;
  document.querySelector("#eventTime").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(next.date);
  document.querySelector("#eventWhen").textContent = next.day;
  document.querySelector("#eventWhere").textContent = next.location;
  document.querySelector("#eventNote").textContent = next.note;
  document.querySelector("#days").textContent = Math.floor(remaining / 86400000);
  document.querySelector("#hours").textContent = Math.floor((remaining % 86400000) / 3600000);
  document.querySelector("#minutes").textContent = Math.floor((remaining % 3600000) / 60000);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  localStorage.setItem(NAME_KEY, name);
  setName(name);
});

document.querySelector("#changeName").addEventListener("click", () => {
  gate.hidden = false;
  nameInput.value = localStorage.getItem(NAME_KEY) || "";
  nameInput.focus();
});

setName(localStorage.getItem(NAME_KEY) || "");
update();
setInterval(update, 30000);
