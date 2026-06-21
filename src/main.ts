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
const monthLabel = getRequiredElement<HTMLHeadingElement>("#month-label");
const calendarGrid = getRequiredElement<HTMLDivElement>("#calendar-grid");
const selectedCount = getRequiredElement<HTMLElement>("#selected-count");
const emptySelection = getRequiredElement<HTMLParagraphElement>("#empty-selection");
const selectedListElement = getRequiredElement<HTMLUListElement>("#selected-list");
const confirmBookingButton = getRequiredElement<HTMLButtonElement>("#confirm-booking");

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

  monthLabel.textContent = monthFormatter.format(visibleMonth);
  calendarGrid.replaceChildren(...days.map(createDayButton));
  selectedCount.textContent = `${selectedList.length} ${selectedList.length === 1 ? "day" : "days"}`;
  confirmBookingButton.disabled = selectedList.length === 0;
  renderSelectedDates(selectedList);
}

function createDayButton(day: CalendarDay): HTMLButtonElement {
  const classNames = [
    "day-button",
    day.inCurrentMonth ? "" : "outside-month",
    day.isToday ? "today" : "",
    day.isRangeStart ? "range-start" : "",
    day.status
  ]
    .filter(Boolean)
    .join(" ");
  const label = `${dayFormatter.format(day.date)}: ${statusLabel(day.status)}`;
  const button = document.createElement("button");
  const dayNumber = document.createElement("span");

  button.className = classNames;
  button.type = "button";
  button.dataset.date = day.iso;
  button.ariaLabel = label;
  button.ariaPressed = day.status === "selected" ? "true" : "false";
  button.disabled = day.status === "unavailable";

  dayNumber.textContent = String(day.dayOfMonth);
  button.append(dayNumber);

  return button;
}

function renderSelectedDates(selectedList: string[]): void {
  if (selectedList.length === 0) {
    emptySelection.hidden = false;
    selectedListElement.hidden = true;
    selectedListElement.replaceChildren();
    return;
  }

  emptySelection.hidden = true;
  selectedListElement.hidden = false;
  selectedListElement.replaceChildren(...selectedList.map(createSelectedDateListItem));
}

function createSelectedDateListItem(iso: string): HTMLLIElement {
  const date = fromIsoDate(iso);
  const label = dayFormatter.format(date);
  const item = document.createElement("li");
  const text = document.createElement("span");
  const removeButton = document.createElement("button");

  text.textContent = label;

  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.dataset.removeDate = iso;
  removeButton.ariaLabel = `Remove ${label}`;
  removeButton.title = "Remove date";
  removeButton.textContent = "x";

  item.append(text, removeButton);

  return item;
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

function getRequiredElement<ElementType extends HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
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
