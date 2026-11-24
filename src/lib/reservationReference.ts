export function getReservationReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}
