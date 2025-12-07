export const QUERY_KEYS = {
  orders: (patientId: string | number | undefined) => ['orders', patientId] as const,
}

