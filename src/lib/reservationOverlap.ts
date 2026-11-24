type ReservationPeriod = {
  room_id?: string | null;
  room?: string | null;
  status: string;
  arrival: string;
  departure: string;
  created_at: string;
  approved_checkin_time?: string | null;
  approved_checkout_time?: string | null;
};

export function hasActiveReservationOverlap(
  reservations: ReservationPeriod[],
  roomId: string,
  startsAt: string,
  endsAt: string,
  roomName?: string,
) {
  const blockStart = new Date(startsAt).getTime();
  const blockEnd = new Date(endsAt).getTime();

  return reservations.some((reservation) => {
    const matchesRoom =
      reservation.room_id === roomId ||
      (!reservation.room_id &&
        Boolean(roomName) &&
        reservation.room === roomName);
    if (!matchesRoom) return false;
    const isActive = ["pending", "confirmed", "in_progress"].includes(
      reservation.status,
    );
    if (!isActive) return false;

    const stayStart = new Date(
      `${reservation.arrival}T${reservation.approved_checkin_time ?? "14:00:00"}Z`,
    ).getTime();
    const stayEnd = new Date(
      `${reservation.departure}T${reservation.approved_checkout_time ?? "12:00:00"}Z`,
    ).getTime();

    return blockStart < stayEnd && blockEnd > stayStart;
  });
}
