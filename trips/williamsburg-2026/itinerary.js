function text(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function eventCard(label, title, items, reservation = false) {
  const card = document.createElement("article");
  card.className = `event${reservation ? " reservation-event" : ""}`;
  card.append(text("time", "", label));
  const body = document.createElement("div");
  body.append(text("span", "pill", reservation ? "Reservation" : "Plan"));
  body.append(text("h4", "", title));
  if (items.length) {
    const list = document.createElement("ul");
    items.forEach((item) => list.append(text("li", "", item)));
    body.append(list);
  }
  card.append(body);
  return card;
}

function dayCard(day, index) {
  const details = document.createElement("details");
  details.className = "day-card";
  details.open = index === 0;
  const summary = document.createElement("summary");
  const heading = document.createElement("div");
  heading.append(text("span", "day-date", `${day.weekday} · ${day.date}`));
  heading.append(text("h3", "", day.title));
  heading.append(text("p", "", day.summary));
  summary.append(heading);
  summary.append(text("span", "day-toggle", "＋"));
  details.append(summary);

  const content = document.createElement("div");
  content.className = "day-content";
  if (day.reservation) content.append(eventCard(day.reservation.time, day.reservation.name, [day.reservation.note], true));
  (day.periods || []).forEach((period) => content.append(eventCard(period.label, period.items[0], period.items.slice(1))));
  if (day.options) content.append(eventCard("Flexible", "Pick what feels right today", day.options));
  if (day.tip) content.append(text("p", "day-tip", day.tip));
  details.append(content);
  return details;
}

function updateClock() {
  document.querySelector("#localClock").textContent = `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date())} EDT`;
}

fetch("itinerary.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load itinerary.json");
    return response.json();
  })
  .then((data) => {
    const days = document.querySelector("#days");
    days.replaceChildren(...data.days.map(dayCard));
  })
  .catch((error) => {
    document.querySelector("#days").textContent = error.message;
  });

updateClock();
setInterval(updateClock, 30000);
