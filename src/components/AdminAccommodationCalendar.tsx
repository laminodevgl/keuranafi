import { useMemo, useState } from "react";
import {
  CalendarDays,
  X,
} from "lucide-react";
import type { Accommodation } from "../data/accommodations";

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";

type CalendarReservation = {
  id: string;
  name: string;
  phone: string;
  arrival: string;
  departure: string;
  room: string;
  room_id?: string | null;
  guests: number;
  adults?: number | null;
  children?: number | null;
  estimated_arrival_time?: string | null;
  approved_checkin_time?: string | null;
  approved_checkout_time?: string | null;
  message: string;
  status: ReservationStatus;
  created_at: string;
};

type CalendarMaintenanceBlock = {
  id: string;
  room_id: string;
  starts_at: string;
  ends_at: string;
  reason: "maintenance" | "cleaning";
  notes: string;
};

type CalendarProps = {
  rooms: Accommodation[];
  reservations: CalendarReservation[];
  blocks: CalendarMaintenanceBlock[];
  isLoading: boolean;
  syncError: string;
  onStatusChange: (id: string, status: ReservationStatus) => Promise<boolean>;
  onDeleteBlock: (block: CalendarMaintenanceBlock) => void;
};

type UnavailableEntry =
  | {
      kind: "reservation";
      startDate: string;
      endDate: string;
      reservation: CalendarReservation;
    }
  | {
      kind: "cleaning";
      startDate: string;
      endDate: string;
      block: CalendarMaintenanceBlock;
    };

const statusLabels: Record<ReservationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  in_progress: "Occupée",
  completed: "Terminée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function dakarDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dakarTodayKey() {
  return dakarDateKey(new Date().toISOString());
}

function weekDateRange(dateKey: string) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const start = toDateKey(date);
  return [start, addDays(start, 6)] as const;
}

function formatDay(value: string, options: Intl.DateTimeFormatOptions = {}) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "numeric",
    month: "short",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Dakar",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminAccommodationCalendar({
  rooms,
  reservations,
  blocks,
  isLoading,
  syncError,
  onStatusChange,
  onDeleteBlock,
}: CalendarProps) {
  const [today] = useState(dakarTodayKey);
  const [initialWeek] = useState(() => weekDateRange(dakarTodayKey()));
  const [rangeStart, setRangeStart] = useState(initialWeek[0]);
  const [rangeEnd, setRangeEnd] = useState(initialWeek[1]);
  const [selectedReservation, setSelectedReservation] =
    useState<CalendarReservation | null>(null);
  const [selectedBlock, setSelectedBlock] =
    useState<CalendarMaintenanceBlock | null>(null);
  const periodIsValid = rangeStart <= rangeEnd;
  const visibleRooms = useMemo(() => {
    if (!periodIsValid) return [];

    return rooms.flatMap((room) => {
      const entries: UnavailableEntry[] = [];
      const rangeEndExclusive = addDays(rangeEnd, 1);

      for (const reservation of reservations) {
        if (!["pending", "confirmed", "in_progress"].includes(reservation.status)) {
          continue;
        }
        const matchesRoom =
          reservation.room_id === room.id ||
          (!reservation.room_id && room.name === reservation.room);
        if (
          !matchesRoom ||
          reservation.arrival >= rangeEndExclusive ||
          reservation.departure < rangeStart
        ) {
          continue;
        }
        entries.push({
          kind: "reservation",
          startDate: reservation.arrival,
          endDate: reservation.departure,
          reservation,
        });
      }

      for (const block of blocks) {
        if (block.reason !== "cleaning") continue;
        const blockStartDate = dakarDateKey(block.starts_at);
        const blockEndDate = dakarDateKey(block.ends_at);
        if (
          block.room_id !== room.id ||
          blockStartDate > rangeEnd ||
          blockEndDate < rangeStart
        ) {
          continue;
        }
        entries.push({
          kind: "cleaning",
          startDate: blockStartDate,
          endDate: blockEndDate,
          block,
        });
      }

      entries.sort((left, right) =>
        left.startDate.localeCompare(right.startDate) ||
        left.endDate.localeCompare(right.endDate),
      );
      return entries.length ? [{ room, entries }] : [];
    });
  }, [blocks, periodIsValid, rangeEnd, rangeStart, reservations, rooms]);

  function chooseToday() {
    setRangeStart(today);
    setRangeEnd(today);
  }

  function chooseThisWeek() {
    const [start, end] = weekDateRange(today);
    setRangeStart(start);
    setRangeEnd(end);
  }

  function entryLabel(entry: UnavailableEntry) {
    return entry.kind === "cleaning"
      ? "Nettoyage"
      : statusLabels[entry.reservation.status];
  }

  function entryTitle(entry: UnavailableEntry) {
    return entry.kind === "cleaning"
      ? entry.block.notes || "Nettoyage planifié"
      : entry.reservation.name;
  }

  function entryPeriod(entry: UnavailableEntry) {
    if (entry.kind === "cleaning") {
      return `${formatTimestamp(entry.block.starts_at)} – ${formatTimestamp(entry.block.ends_at)}`;
    }

    const arrivalTime =
      entry.reservation.approved_checkin_time?.slice(0, 5) ??
      entry.reservation.estimated_arrival_time?.slice(0, 5) ??
      "14:00";
    const departureTime =
      entry.reservation.approved_checkout_time?.slice(0, 5) ?? "12:00";
    return `${formatDay(entry.reservation.arrival, { year: "numeric" })} à ${arrivalTime} – ${formatDay(entry.reservation.departure, { year: "numeric" })} à ${departureTime}`;
  }

  function openEntry(entry: UnavailableEntry) {
    if (entry.kind === "cleaning") setSelectedBlock(entry.block);
    else setSelectedReservation(entry.reservation);
  }

  const selectedRoomName = (roomId: string) =>
    rooms.find((room) => room.id === roomId)?.name ?? "Chambre inconnue";

  return (
    <div className="admin-accommodation-calendar">
      {syncError && <p className="admin-error" role="alert">{syncError}</p>}

      <div className="admin-calendar-toolbar">
        <div className="admin-calendar-period-presets" role="group" aria-label="Raccourcis de période">
          <button
            type="button"
            className={rangeStart === today && rangeEnd === today ? "is-active" : ""}
            aria-pressed={rangeStart === today && rangeEnd === today}
            onClick={chooseToday}
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            className={
              rangeStart === weekDateRange(today)[0] &&
              rangeEnd === weekDateRange(today)[1]
                ? "is-active"
                : ""
            }
            aria-pressed={
              rangeStart === weekDateRange(today)[0] &&
              rangeEnd === weekDateRange(today)[1]
            }
            onClick={chooseThisWeek}
          >
            Cette semaine
          </button>
        </div>
        <div className="admin-calendar-period-fields">
          <label>
            Du
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              aria-label="Début de la période"
            />
          </label>
          <label>
            Au
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart}
              onChange={(event) => setRangeEnd(event.target.value)}
              aria-label="Fin de la période"
            />
          </label>
        </div>
      </div>

      {!periodIsValid && (
        <p className="admin-error" role="alert">
          La date de fin doit être égale ou postérieure à la date de début.
        </p>
      )}

      {isLoading ? (
        <p role="status">Chargement des indisponibilités…</p>
      ) : (
        visibleRooms.length ? (
          <div className="admin-unavailable-rooms">
            {visibleRooms.map(({ room, entries }) => (
              <section className="admin-unavailable-room" key={room.id}>
                <header>
                  <div>
                    <h3>{room.name}</h3>
                    <span>
                      {room.capacity ? `${room.capacity} personne(s) max.` : "Capacité non précisée"}
                    </span>
                  </div>
                  <strong>{entries.length} indisponibilité(s)</strong>
                </header>
                <div className="admin-unavailable-entries">
                  {entries.map((entry) => (
                    <button
                      type="button"
                      className={`admin-unavailable-entry is-${entry.kind === "cleaning" ? "cleaning" : entry.reservation.status}`}
                      key={entry.kind === "cleaning" ? entry.block.id : entry.reservation.id}
                      onClick={() => openEntry(entry)}
                    >
                      <span className="admin-unavailable-entry-heading">
                        <strong>{entryTitle(entry)}</strong>
                        <span className="admin-unavailable-status">{entryLabel(entry)}</span>
                      </span>
                      <span className="admin-unavailable-entry-period">
                        <CalendarDays size={14} aria-hidden="true" />
                        {entryPeriod(entry)}
                      </span>
                      {entry.kind === "cleaning" && entry.block.notes && (
                        <span className="admin-unavailable-entry-notes">{entry.block.notes}</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="admin-unavailable-empty" role="status">
            {periodIsValid
              ? "Aucune chambre n’est indisponible pendant cette période."
              : "Choisissez une période valide pour consulter les indisponibilités."}
          </div>
        )
      )}

      {selectedReservation && (
        <div className="admin-calendar-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedReservation(null);
        }}>
          <section className="admin-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-calendar-reservation-title">
            <header>
              <div>
                <span className="eyebrow">Détail de réservation</span>
                <h3 id="admin-calendar-reservation-title">{selectedReservation.name}</h3>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setSelectedReservation(null)}><X size={20} /></button>
            </header>
            <dl className="admin-calendar-dialog-details">
              <div><dt>Chambre</dt><dd>{selectedReservation.room}</dd></div>
              <div><dt>Statut</dt><dd>{statusLabels[selectedReservation.status]}</dd></div>
              <div><dt>Séjour</dt><dd>{selectedReservation.arrival} → {selectedReservation.departure}</dd></div>
              <div><dt>Arrivée estimée</dt><dd>{selectedReservation.approved_checkin_time?.slice(0, 5) ?? selectedReservation.estimated_arrival_time?.slice(0, 5) ?? "14:00"}</dd></div>
              <div><dt>Départ</dt><dd>{selectedReservation.approved_checkout_time?.slice(0, 5) ?? "Avant 12 h 00"}</dd></div>
              <div><dt>Voyageurs</dt><dd>{selectedReservation.adults ?? selectedReservation.guests} adulte(s), {selectedReservation.children ?? 0} enfant(s)</dd></div>
              <div><dt>Téléphone</dt><dd><a href={`tel:${selectedReservation.phone}`}>{selectedReservation.phone}</a></dd></div>
              <div><dt>Demande reçue</dt><dd>{formatTimestamp(selectedReservation.created_at)}</dd></div>
            </dl>
            {selectedReservation.message && <p className="admin-calendar-dialog-message">{selectedReservation.message}</p>}
            <label className="admin-calendar-dialog-status">
              Modifier le statut
              <select
                value={selectedReservation.status}
                onChange={async (event) => {
                  const status = event.target.value as ReservationStatus;
                  if (await onStatusChange(selectedReservation.id, status)) {
                    setSelectedReservation({ ...selectedReservation, status });
                  }
                }}
              >
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </section>
        </div>
      )}

      {selectedBlock && (
        <div className="admin-calendar-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedBlock(null);
        }}>
          <section className="admin-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-calendar-block-title">
            <header>
              <div>
                <span className="eyebrow">Indisponibilité</span>
                <h3 id="admin-calendar-block-title">{selectedBlock.reason === "cleaning" ? "Nettoyage" : "Maintenance"}</h3>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setSelectedBlock(null)}><X size={20} /></button>
            </header>
            <dl className="admin-calendar-dialog-details">
              <div><dt>Chambre</dt><dd>{selectedRoomName(selectedBlock.room_id)}</dd></div>
              <div><dt>Début</dt><dd>{formatTimestamp(selectedBlock.starts_at)}</dd></div>
              <div><dt>Fin</dt><dd>{formatTimestamp(selectedBlock.ends_at)}</dd></div>
            </dl>
            {selectedBlock.notes && <p className="admin-calendar-dialog-message">{selectedBlock.notes}</p>}
            <button className="admin-delete-button" type="button" onClick={() => {
              onDeleteBlock(selectedBlock);
              setSelectedBlock(null);
            }}>
              Supprimer cette indisponibilité
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
