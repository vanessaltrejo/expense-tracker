"use client";

import { placeOfNote } from "@/domain/places";

/**
 * Frequent places as one row that scrolls sideways, so a long list never pushes the rest
 * of the form down. Tapping the chosen place again clears it.
 */
export function PlacePicker({
  places,
  knownPlaces,
  value,
  onChange,
  bleed = "-mx-4 px-4",
}: {
  /** The places offered here. */
  places: string[];
  /** Every place of the Sheet, so a note with detail ("Bread · pain aux chocolat") still matches. */
  knownPlaces: string[];
  value: string;
  onChange: (place: string) => void;
  /** How far the row reaches past its container so it scrolls edge to edge. */
  bleed?: string;
}) {
  const chosen = value.trim() === "" ? "" : placeOfNote(value, [...knownPlaces, ...places]).toLowerCase();

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">¿Dónde fue?</legend>
      <div className={`${bleed} flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {places.map((place) => {
          const isChosen = chosen === place.toLowerCase();
          return (
            <button
              key={place}
              type="button"
              aria-pressed={isChosen}
              className="chip shrink-0 whitespace-nowrap"
              onClick={() => onChange(isChosen ? "" : place)}
            >
              {place}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
