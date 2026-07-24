(function () {
  const STORAGE_KEY = "driveapplied-williamsburg-theme";
  const themes = {
    before: {
      label: "Manor Club Pool",
      image: "assets/themes/resort-pool.jpg",
      position: "center 50%",
      overlay: "linear-gradient(180deg, rgba(4,18,22,.28), rgba(5,15,16,.74))"
    },
    "2026-07-24": {
      label: "Arrival at Manor Club",
      image: "assets/themes/arrival-resort.webp",
      position: "center 52%",
      overlay: "linear-gradient(180deg, rgba(6,20,23,.24), rgba(5,15,16,.75))"
    },
    "2026-07-25": {
      label: "Colonial Williamsburg",
      image: "assets/themes/colonial-williamsburg.jpg",
      position: "center 42%",
      overlay: "linear-gradient(180deg, rgba(18,13,7,.2), rgba(8,13,13,.76))"
    },
    "2026-07-26": {
      label: "Yorktown",
      image: "assets/themes/yorktown.jpg",
      position: "center 42%",
      overlay: "linear-gradient(180deg, rgba(9,18,24,.24), rgba(6,15,18,.76))"
    },
    "2026-07-27": {
      label: "Jamestown",
      image: "assets/themes/jamestown.jpg",
      position: "center 46%",
      overlay: "linear-gradient(180deg, rgba(17,18,10,.2), rgba(8,15,14,.78))"
    },
    "2026-07-28": {
      label: "Busch Gardens",
      image: "assets/themes/busch-gardens.jpg",
      position: "center 44%",
      overlay: "linear-gradient(180deg, rgba(8,20,27,.18), rgba(5,13,18,.78))"
    },
    "2026-07-29": {
      label: "Coaster Favorites",
      image: "assets/themes/busch-gardens-coasters.jpg",
      position: "center 45%",
      overlay: "linear-gradient(180deg, rgba(8,18,27,.2), rgba(5,13,18,.8))"
    },
    "2026-07-30": {
      label: "Williamsburg Flex Day",
      image: "assets/themes/flex-williamsburg.jpg",
      position: "center 48%",
      overlay: "linear-gradient(180deg, rgba(13,18,13,.2), rgba(6,14,13,.78))"
    },
    "2026-07-31": {
      label: "One Last Morning",
      image: "assets/themes/departure-resort.jpg",
      position: "center 48%",
      overlay: "linear-gradient(180deg, rgba(6,17,21,.24), rgba(5,14,16,.78))"
    },
    after: {
      label: "Williamsburg Inn Memories",
      image: "assets/themes/williamsburg-inn.jpg",
      position: "center 48%",
      overlay: "linear-gradient(180deg, rgba(12,17,12,.22), rgba(5,13,13,.78))"
    }
  };

  function easternDateKey(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function selectTheme() {
    const previewDate = new URLSearchParams(location.search).get("themeDate");
    const dateKey = previewDate && /^\d{4}-\d{2}-\d{2}$/.test(previewDate)
      ? previewDate
      : easternDateKey(new Date());

    if (themes[dateKey]) return { id: dateKey, ...themes[dateKey] };
    if (dateKey < "2026-07-24") return { id: "before", ...themes.before };
    return { id: "after", ...themes.after };
  }

  const theme = selectTheme();
  document.documentElement.style.setProperty("--theme-background-image", `url("${theme.image}")`);
  document.documentElement.style.setProperty("--theme-background-position", theme.position);
  document.documentElement.style.setProperty("--theme-overlay", theme.overlay);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(theme));

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-theme-label]").forEach((element) => {
      element.textContent = `Today’s theme: ${theme.label}`;
    });
  });
})();
