import "./styles.css";

type DayStatus = "available" | "unavailable" | "selected";

interface CalendarDay {
  date: Date;
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isRangeStart: boolean;
  status: DayStatus;
}

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("App root was not found.");
}

const app = appRoot;

const today = startOfDay(new Date());
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const unavailableDates = new Set<string>([
  "2026-06-24",
  "2026-06-25",
  "2026-06-26",
  "2026-07-03",
  "2026-07-04",
  "2026-07-05",
  "2026-07-12",
  "2026-07-18",
  "2026-07-19",
  "2026-08-01",
  "2026-08-02",
  "2026-08-09",
  "2026-08-10"
]);

const selectedDates = new Set<string>();
let rangeStartDate: string | null = null;

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric"
});
const dayFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

function render(): void {
  const days = getCalendarDays(visibleMonth);
  const selectedList = getSortedSelectedDates();

  app.innerHTML = `
    <section class="booking-shell" aria-labelledby="calendar-title">
      <div class="booking-header">
        <div>
          <p class="eyebrow">Holiday cottage</p>
          <h1 id="calendar-title">Book available days</h1>
        </div>
        <div class="legend" aria-label="Calendar legend">
          <span><i class="legend-dot available"></i>Available</span>
          <span><i class="legend-dot selected"></i>Selected</span>
          <span><i class="legend-dot unavailable"></i>Unavailable</span>
        </div>
      </div>

      <div class="calendar-layout">
        <section class="calendar-panel" aria-label="Calendar">
          <div class="calendar-toolbar">
            <button class="icon-button" type="button" data-action="previous-month" aria-label="Previous month" title="Previous month">
              <span aria-hidden="true">&lt;</span>
            </button>
            <h2>${monthFormatter.format(visibleMonth)}</h2>
            <button class="icon-button" type="button" data-action="next-month" aria-label="Next month" title="Next month">
              <span aria-hidden="true">&gt;</span>
            </button>
          </div>

          <div class="weekday-row" aria-hidden="true">
            ${weekdayLabels.map((weekday) => `<span>${weekday}</span>`).join("")}
          </div>

          <div class="calendar-grid">
            ${days.map(renderDayButton).join("")}
          </div>
        </section>

        <aside class="summary-panel" aria-label="Booking summary">
          <div class="summary-topline">
            <p class="eyebrow">Your booking</p>
            <strong>${selectedList.length} ${selectedList.length === 1 ? "day" : "days"}</strong>
          </div>
          ${renderSelectedDates(selectedList)}
          <button class="primary-button" type="button" data-action="confirm-booking" ${selectedList.length === 0 ? "disabled" : ""}>
            Confirm booking
          </button>
        </aside>
      </div>
    </section>
  `;
}

function renderDayButton(day: CalendarDay): string {
  const classNames = [
    "day-button",
    day.inCurrentMonth ? "" : "outside-month",
    day.isToday ? "today" : "",
    day.isRangeStart ? "range-start" : "",
    day.status
  ]
    .filter(Boolean)
    .join(" ");
  const disabled = day.status === "unavailable" ? "disabled" : "";
  const pressed = day.status === "selected" ? "true" : "false";
  const label = `${dayFormatter.format(day.date)}: ${statusLabel(day.status)}`;

  return `
    <button
      class="${classNames}"
      type="button"
      data-date="${day.iso}"
      aria-label="${label}"
      aria-pressed="${pressed}"
      ${disabled}
    >
      <span>${day.dayOfMonth}</span>
    </button>
  `;
}

function renderSelectedDates(selectedList: string[]): string {
  if (selectedList.length === 0) {
    return `
      <p class="empty-state">Choose one or more available days in the calendar.</p>
    `;
  }

  return `
    <ul class="selected-list">
      ${selectedList
        .map((iso) => {
          const date = fromIsoDate(iso);
          return `
            <li>
              <span>${dayFormatter.format(date)}</span>
              <button type="button" class="remove-button" data-remove-date="${iso}" aria-label="Remove ${dayFormatter.format(date)}" title="Remove date">
                x
              </button>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function getCalendarDays(month: Date): CalendarDay[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const iso = toIsoDate(date);
    const inCurrentMonth = date.getMonth() === month.getMonth();
    const status = getDayStatus(iso);

    return {
      date,
      iso,
      dayOfMonth: date.getDate(),
      inCurrentMonth,
      isToday: iso === toIsoDate(today),
      isRangeStart: iso === rangeStartDate,
      status
    };
  });
}

function getDayStatus(iso: string): DayStatus {
  if (unavailableDates.has(iso)) {
    return "unavailable";
  }

  if (selectedDates.has(iso)) {
    return "selected";
  }

  return "available";
}

function statusLabel(status: DayStatus): string {
  if (status === "unavailable") {
    return "unavailable";
  }

  if (status === "selected") {
    return "selected for booking";
  }

  return "available";
}

function getSortedSelectedDates(): string[] {
  return [...selectedDates].sort((first, second) => first.localeCompare(second));
}

function selectDate(iso: string): void {
  if (selectedDates.has(iso)) {
    selectedDates.delete(iso);

    if (rangeStartDate === iso) {
      rangeStartDate = null;
    }

    return;
  }

  if (!rangeStartDate || !selectedDates.has(rangeStartDate)) {
    selectedDates.add(iso);
    rangeStartDate = iso;
    return;
  }

  const rangeDates = getIsoDateRange(rangeStartDate, iso);
  const unavailableDatesInRange = rangeDates.filter((rangeDate) => unavailableDates.has(rangeDate));

  if (unavailableDatesInRange.length > 0) {
    const dates = unavailableDatesInRange
      .map((rangeDate) => dayFormatter.format(fromIsoDate(rangeDate)))
      .join(", ");
    window.alert(`That booking range includes unavailable days: ${dates}.`);
    return;
  }

  rangeDates.forEach((rangeDate) => selectedDates.add(rangeDate));
  rangeStartDate = null;
}

function getIsoDateRange(startIso: string, endIso: string): string[] {
  const start = fromIsoDate(startIso);
  const end = fromIsoDate(endIso);
  const direction = start <= end ? 1 : -1;
  const dates: string[] = [];
  let current = start;

  while (true) {
    dates.push(toIsoDate(current));

    if (toIsoDate(current) === endIso) {
      return dates;
    }

    current = addDays(current, direction);
  }
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

app.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>("[data-action]");
  const dateButton = target.closest<HTMLButtonElement>("[data-date]");
  const removeButton = target.closest<HTMLButtonElement>("[data-remove-date]");

  if (actionButton?.dataset.action === "previous-month") {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    render();
    return;
  }

  if (actionButton?.dataset.action === "next-month") {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    render();
    return;
  }

  if (actionButton?.dataset.action === "confirm-booking") {
    const dates = getSortedSelectedDates().map((iso) => dayFormatter.format(fromIsoDate(iso)));
    window.alert(`Booking requested for ${dates.join(", ")}.`);
    return;
  }

  if (removeButton?.dataset.removeDate) {
    selectedDates.delete(removeButton.dataset.removeDate);

    if (rangeStartDate === removeButton.dataset.removeDate) {
      rangeStartDate = null;
    }

    render();
    return;
  }

  if (dateButton?.dataset.date && !dateButton.disabled) {
    selectDate(dateButton.dataset.date);
    render();
  }
});

render();
