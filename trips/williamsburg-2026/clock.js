function updateClock() {
  document.querySelector("#localClock").textContent = `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date())} EDT`;
}
updateClock();
setInterval(updateClock, 30000);
