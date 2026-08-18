/** Envelope returned by every REST API response. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  timestamp: string;
}
