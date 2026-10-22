"use client";

import { createContext, useContext } from "react";
import type { StudioState } from "./useCourseStudio";

const StudioContext = createContext<StudioState | null>(null);

export function StudioProvider({
  value,
  children,
}: {
  value: StudioState;
  children: React.ReactNode;
}) {
  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio(): StudioState {
  const value = useContext(StudioContext);
  if (!value) {
    throw new Error("useStudio must be used inside StudioProvider.");
  }
  return value;
}
