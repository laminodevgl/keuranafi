import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { getErrorMessage } from "../lib/errorMessage";
import { supabase } from "../lib/supabase";

type BookedRange = {
  arrival: string;
  departure: string;
};

type ReservationDatePickerProps = {
  roomId: string;
  refreshToken: number;
  arrival: string;
  departure: string;
  onChange: (arrival: string, departure: string) => void;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fromDateKey(value));
}

function rangeOverlaps(
  arrival: string,
  departure: string,
  booked: BookedRange,
) {
  return arrival < booked.departure && departure > booked.arrival;
}

export default function ReservationDatePicker({
  roomId,
  refreshToken,
  arrival,
  departure,
  onChange,
}: ReservationDatePickerProps) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBookedRanges() {
      if (!supabase) {
        setLoadError("Le calendrier n’est pas connecté à Supabase.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");
      try {
        const { data, error } = await supabase.rpc(
          "get_booked_room_dates",
          { p_room_id: roomId },
        );
        if (error) throw error;
        if (active) setBookedRanges((data ?? []) as BookedRange[]);
      } catch (error) {
        if (active) {
          setLoadError(
            `Impossible de charger les dates disponibles : ${getErrorMessage(error)}`,
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadBookedRanges();
    return () => {
      active = false;
    };
  }, [roomId, refreshToken]);

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = (month.getDay() + 6) % 7;
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const today = toDateKey(new Date());
  const days = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  function isBookedNight(date: string) {
    return bookedRanges.some(
      (range) => date >= range.arrival && date < range.departure,
    );
  }

  function hasBookedNight(arrivalDate: string, departureDate: string) {
    return bookedRanges.some((range) =>
      rangeOverlaps(arrivalDate, departureDate, range),
    );
  }

  function isDisabled(date: string) {
    if (isLoading || Boolean(loadError) || date < today) return true;
    return isBookedNight(date);
  }

  function selectDate(date: string) {
    if (isDisabled(date)) return;
    onChange(date, addDays(date, 1));
  }

  function changeNights(offset: number) {
    if (!arrival || !departure) return;
    const nights = Math.round(
      (fromDateKey(departure).getTime() - fromDateKey(arrival).getTime()) /
        86_400_000,
    );
    const nextDeparture = addDays(arrival, nights + offset);
    if (nights + offset < 1 || hasBookedNight(arrival, nextDeparture)) return;
    onChange(arrival, nextDeparture);
  }

  function changeMonth(offset: number) {
    setMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  useEffect(() => {
    if (
      !isLoading &&
      !loadError &&
      arrival &&
      departure &&
      hasBookedNight(arrival, departure)
    ) {
      onChange("", "");
    }
  }, [arrival, bookedRanges, departure, isLoading, loadError, onChange]);

  return (
    <div className="reservation-date-picker">
      {isLoading ? (
        <p className="reservation-calendar-status" role="status">
          Chargement des dates disponibles…
        </p>
      ) : loadError ? (
        <p className="reservation-error" role="alert">{loadError}</p>
      ) : (
        <>
          <div className="reservation-calendar-header">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={
                month.getFullYear() === new Date().getFullYear() &&
                month.getMonth() === new Date().getMonth()
              }
              aria-label="Mois précédent"
            >
              <ChevronLeft size={18} />
            </button>
            <strong aria-live="polite">
              {new Intl.DateTimeFormat("fr-FR", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </strong>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Mois suivant"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="reservation-calendar-grid" role="grid" aria-label="Choisir les dates du séjour">
            {["L", "M", "M", "J", "V", "S", "D"].map((weekday, index) => (
              <span
                className="reservation-calendar-weekday"
                key={`${weekday}-${index}`}
                role="columnheader"
              >
                {weekday}
              </span>
            ))}
            {days.map((day, index) => {
              if (day === null) {
                return (
                  <span
                    className="reservation-calendar-empty"
                    key={`empty-${index}`}
                    role="gridcell"
                  />
                );
              }
              const date = toDateKey(
                new Date(month.getFullYear(), month.getMonth(), day),
              );
              const isBooked = isBookedNight(date);
              const isSelected = date === arrival;
              const isBetween = Boolean(
                arrival && departure && date > arrival && date < departure,
              );

              return (
                <div role="gridcell" key={date}>
                  <button
                    type="button"
                    className={[
                      "reservation-calendar-day",
                      isBooked ? "is-booked" : "",
                      isSelected ? "is-selected" : "",
                      isBetween ? "is-between" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isDisabled(date)}
                    aria-pressed={isSelected}
                    aria-label={`${formatDate(date)}${
                      isBooked
                        ? ", nuit indisponible"
                        : ""
                    }`}
                    onClick={() => selectDate(date)}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>
          {arrival && departure && (
            <div className="reservation-night-count">
              <span>
                {Math.round(
                  (fromDateKey(departure).getTime() -
                    fromDateKey(arrival).getTime()) /
                    86_400_000,
                )}{" "}
                nuit(s) · Départ le {formatDate(departure)} avant 12 h
              </span>
              <div>
                <button
                  type="button"
                  aria-label="Retirer une nuit"
                  disabled={
                    (fromDateKey(departure).getTime() -
                      fromDateKey(arrival).getTime()) /
                      86_400_000 <=
                    1
                  }
                  onClick={() => changeNights(-1)}
                >
                  <Minus size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Ajouter une nuit"
                  disabled={hasBookedNight(arrival, addDays(departure, 1))}
                  onClick={() => changeNights(1)}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          )}
          <div className="reservation-calendar-legend">
            <span><i className="is-booked" /> Indisponible</span>
            <span><i className="is-selected" /> Sélectionné</span>
          </div>
          <p className="reservation-calendar-hint" aria-live="polite">
            {arrival && departure
              ? `Nuit(s) du ${formatDate(arrival)} au ${formatDate(addDays(departure, -1))}.`
              : "Choisissez votre première nuit. Le départ sera fixé automatiquement au lendemain avant 12 h."}
          </p>
        </>
      )}
    </div>
  );
}
