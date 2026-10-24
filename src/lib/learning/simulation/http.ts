import { apiError, HttpError } from "@/lib/supabase/server";
import { SimulationError } from "./engine";

/** Engine failures carry their own status. A plain Error must not hide them as 500. */
export function simulationApiError(error: unknown) {
  if (error instanceof SimulationError) {
    return apiError(new HttpError(error.status, error.message));
  }
  return apiError(error);
}
