# Frontend handoff: onboarding, profile, vehicles, parking photos

Owner: Aditya (frontend, `dev` branch). Backend and database: Manav.
Status: backend implemented on `manav` (not deployed yet). This document is the contract.

Ground rules:
- Build on the current `dev` architecture: `contexts/AuthContext.tsx`, the session-keyed stack in `App.tsx`, `DialogContext`/`AppDialog`, `ListRow`, `PrimaryButton`, `useKeyboardAwareScroll`, `constants/tokens.ts`, `constants/images.ts`.
- Do not redesign Home or Profile. Add to the existing ticket cards and sections.
- Never send `user_id` to the backend. The server takes identity from the bearer token.
- All new endpoints need `Authorization: Bearer <session.access_token>`.

---

## 1. API contract

Base URL: `API_BASE_URL` in `lib/api.ts`. Errors are JSON `{ error: string, code?: string }`. Reuse `getErrorMessage`.

### Types (add to `lib/api.ts`)

```ts
export type Vehicle = {
  id: string;
  vehicle_number: string;   // normalized, e.g. "KA01AB1234"
  is_primary: boolean;
  created_at: string;
};

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  address: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  vehicles: Vehicle[];      // primary first, then oldest first
};

export type SpotPhotoAttribution = {
  display_name: string | null;
  uri: string | null;       // https link to the author's profile, or null
  photo_uri: string | null; // author avatar, or null
};

export type SpotPhoto = {
  uri: string;              // short-lived Google image URL. Use immediately, never store.
  width_px: number | null;
  height_px: number | null;
  attributions: SpotPhotoAttribution[];  // may be empty; may have several entries
  google_maps_uri: string | null;
  flag_content_uri: string | null;
};
```

### Endpoints

| Method and path | Body | Success | Error codes |
|---|---|---|---|
| `GET /user/profile` | none | 200 `UserProfile` (creates the profile row if missing) | 401 |
| `PATCH /user/profile` | `{ name?: string, address?: string \| null }` | 200 `UserProfile` | 400 `VALIDATION_ERROR` |
| `POST /user/onboarding` | `{ name: string, address?: string \| null, vehicles: string[] }` (1 to 3) | 200 `UserProfile` with `onboarding_completed: true` | 400 `VALIDATION_ERROR`, 409 `VEHICLE_LIMIT` |
| `POST /user/vehicles` | `{ vehicle_number: string, is_primary?: boolean }` | 201 `{ vehicles: Vehicle[] }` | 400, 409 `VEHICLE_EXISTS`, 409 `VEHICLE_LIMIT` |
| `PATCH /user/vehicles/:id` | `{ is_primary: true }` | 200 `{ vehicles: Vehicle[] }` | 400, 404 `VEHICLE_NOT_FOUND` |
| `DELETE /user/vehicles/:id` | none | 200 `{ vehicles: Vehicle[] }` | 404 `VEHICLE_NOT_FOUND` |
| `GET <photo_lookup_url>` (plus optional `?w=800`) | none | 200 `{ photo: SpotPhoto \| null }` | 400, 401, 404, 429, 502, 503 |

Behaviour to rely on:
- Onboarding is idempotent. Retrying the same submit is safe and creates no duplicates.
- The first onboarding vehicle becomes primary if the user has none.
- Every vehicle mutation returns the full, ordered list. Replace local state with it; do not patch locally.
- Deleting the primary vehicle promotes the oldest remaining one. Deleting the last vehicle is allowed.
- Max 5 vehicles per user (hide "Add vehicle" at 5).

### New field on existing spot payloads

`photo_lookup_url: string | null` now appears on:
- `POST /search`: every item in `spots[]`, and `sponsored`
- `GET /search/:id`
- `GET /saved` items
- `GET /profile/listings` items
- `GET /sessions/history`: each item's `parking_spots` (which also gains `id` and `google_place_id`)

It is a JSON lookup endpoint, **not** an image URL. Do not put it in `<Image source>`. `null` means no photo is possible: show the placeholder.

Add `photo_lookup_url?: string | null` to `ParkingSpot` (`types/parking.ts`), `SavedSpot`, `ListingDetails`, and `ParkingHistoryItem['parking_spots']`.

### Normalization (mirror the server)

```ts
// lib/vehicleNumber.ts
export function normalizeVehicleNumber(value: string) {
  return value.toUpperCase().replace(/[\s.-]/g, '');
}
export function isValidVehicleNumber(value: string) {
  return /^[A-Z0-9]{4,12}$/.test(normalizeVehicleNumber(value));
}
```
Name: trimmed, 1 to 100 characters. Address: trimmed, up to 300 characters, empty means none.

---

## 2. Auth gate (`contexts/AuthContext.tsx`, `App.tsx`)

Extend AuthContext:
```ts
profile: UserProfile | null;
profileStatus: 'idle' | 'loading' | 'ready' | 'error';
refreshProfile: () => Promise<void>;
setProfile: (profile: UserProfile) => void;
```
- Fetch `GET /user/profile` when `session?.user.id` changes. Key the effect on the user id, not the session object, so token refreshes don't refetch.
- On sign-out, clear `profile` and set `profileStatus` to `'idle'`.
- Ignore stale responses (compare the user id at response time) so a slow request can't overwrite a newer user.

In `AppNavigator`, inside the authenticated branch, decide in this order:
1. `profileStatus` is `'idle'` or `'loading'`: show the existing `LoadingScreen`.
2. `profileStatus === 'error'`: show a small error screen with **Retry** (`refreshProfile`) and **Sign out**. Never route to onboarding or MainTabs on an error; that's what prevents wrong-screen flashes and redirect loops.
3. `profile.onboarding_completed === false`: render a stack containing only `OnboardingForm`.
4. Otherwise: the existing stack (Consent or MainTabs as today).

Also:
- Include the onboarding state in the stack `key` (for example `'authenticated-onboarding'` vs `'authenticated'`) so the switch is a clean remount.
- Add `profile?.onboarding_completed` to the conditions of the pending post-login destination restore and of deferred notification handling, so neither fires during onboarding.
- `EmailLoginScreen` needs no change. The navigator reacts to the session and profile.

---

## 3. OnboardingFormScreen (`screens/OnboardingFormScreen.tsx`, route `OnboardingForm`)

Add `OnboardingForm: undefined` to `RootStackParamList`.

Fields:
- **Name**: prefilled from `profile.name`, else `user.user_metadata.full_name` or `name`. Editable. Required.
- **Vehicle number**: one row to start. "Add another vehicle" adds rows up to 3. Each extra row has a remove control. Normalize to uppercase as the user types (`autoCapitalize="characters"`, `autoCorrect={false}`). Show inline errors for invalid or duplicate rows. At least one valid vehicle is required.
- **Address** (optional).
- **Submit** (`PrimaryButton`): disabled while submitting or invalid. Calls `POST /user/onboarding` with the normalized, de-duplicated list.
- **Sign out** link (an escape hatch, so the user is never trapped).

On success: `setProfile(response)`. **Do not navigate manually**; the gate swaps to MainTabs. On error: show `showDialog({ type: 'error', ... })` with the server message; the form keeps its values so the user can retry.

Use `useKeyboardAwareScroll`, theme colors from `useTheme()`, and spacing/typography tokens.

---

## 4. Parking photos

### Rules from Google's terms (these are requirements, not suggestions)
- Never store or cache the photo response or the image: no AsyncStorage, no module-level cache, and `expo-image` with `cachePolicy="none"` for Google images.
- Show **every** entry in `attributions` wherever the image is shown, as plain text (never render HTML). Make a name tappable to `uri` (via `Linking.openURL`) when `uri` is present.
- Show a **"Google Maps"** text attribution with Google photos (12 to 16sp, normal weight 400, one line, not translated, color #5E5E5E or white/black with 4.5:1 contrast). Place it near the top or bottom of the image, inside the same card.
- If `google_maps_uri` is present, offer "View on Google Maps".
- On small thumbnails you may hide the author names only if tapping opens a larger view (for example ParkingDetails) that shows the full attribution.

### `hooks/useSpotPhoto.ts`
```ts
// Fetches a fresh photo when enabled; result lives only in component state.
export function useSpotPhoto(lookupUrl: string | null | undefined, enabled: boolean, width: 400 | 800 = 400)
// returns { photo: SpotPhoto | null, status: 'idle' | 'loading' | 'ready' | 'none' | 'error' }
```
- Only fetch when `lookupUrl` is set and `enabled` is true (the card is on screen).
- Send the bearer token. Append `?w=800` only for large/hero images.
- Any non-200, `photo: null`, or network error means the placeholder. Do not retry automatically (each call can be billed).
- Abort or ignore the result on unmount.

### `components/ui/SpotImage.tsx`
- Props: `lookupUrl`, `style`, `variant: 'thumbnail' | 'card' | 'hero'`, `visible?: boolean`.
- Renders `PARKING_PLACEHOLDER_URI` (from `constants/images.ts`) while loading, on `none`/`error`, and on the image's `onError`.
- Renders the Google `uri` with `expo-image`, `cachePolicy="none"`, `contentFit="cover"`.
- Renders the "Google Maps" text and the author attribution overlay (subject to the thumbnail rule above).

### Where to use it
- **Home "Parking near you"** tickets: add a `SpotImage` thumbnail inside `ticketTop`. Keep the ticket geometry (tear line, notches) unchanged. Pass `visible` based on the rail's viewable items so only on-screen cards fetch.
- **Home "Park again"** tickets (this is the "last parked" UI): add `photoLookupUrl` to `ParkAgainSpot` from `item.parking_spots?.photo_lookup_url`, render `SpotImage`, and include `photo_lookup_url` when `handleParkAgain` builds the `ParkingSpot`.
- **`components/ParkingSpotCard.tsx`**: replace the hardcoded `PARKING_PLACEHOLDER_URI` image with `SpotImage` (variant `card`).
- **`screens/SavedScreen.tsx`**: `convertToParkingSpot` must pass `photo_lookup_url`.
- Optional: `SponsoredCard` and a ParkingDetails hero (`w=800`, full attribution shown here).

---

## 5. Profile screen (`screens/ProfileScreen.tsx`)

- Load from `GET /user/profile` instead of `GET /profile/:id` (it includes `name`, `avatar_url`, `address`, `vehicles`). Keep `POST /profile/update` for the avatar upload flow, which is unchanged. After a profile change, also call `setProfile` so AuthContext stays in sync.
- **MY VEHICLES** section, using the same section label and `ListRow` style as MY LISTINGS / ACCOUNT:
  - one row per vehicle: number, a "Primary" badge on the primary one
  - row actions: "Set as primary" (`PATCH /user/vehicles/:id { is_primary: true }`) for non-primary rows, and "Delete" (confirm with `AppDialog`, then `DELETE /user/vehicles/:id`)
  - "Add vehicle" row, hidden when there are 5 vehicles; it opens `AddVehicleSheet`
  - empty state text when there are no vehicles
  - disable a row's actions while its request is in flight
- **Address** row: shows the address or "Add address"; inline edit like the existing name edit; save with `PATCH /user/profile { address }` (send `null` or `""` to clear).

## 6. Add vehicle UI (`components/AddVehicleSheet.tsx`)

No new navigation route. A modal/bottom sheet opened from Profile with one vehicle-number input (normalized as typed), a "Make primary" toggle, Save, and Cancel. Calls `POST /user/vehicles`. On 201, replace the list with `response.vehicles` and close. On `VEHICLE_EXISTS` or `VEHICLE_LIMIT`, show the server message.

---

## 7. Test checklist

- New Google user: Onboarding (name prefilled), then MainTabs after submit.
- Returning onboarded user: straight to MainTabs; relaunch shows no onboarding flash.
- Existing user from before this release: sees onboarding once.
- Airplane mode during profile load: retry screen, not onboarding; Retry recovers.
- Double-tap Submit: one profile, no duplicate vehicles.
- Sign out from onboarding returns to Welcome; signing in as another user shows their own state.
- Pending post-login destination still opens after onboarding finishes.
- Profile: add, set primary, delete primary (oldest becomes primary), delete last, hit the 5 limit, duplicate number (spaces/lowercase) rejected.
- Photos: real images on near-you, park-again, search results, saved; placeholder for `photo_lookup_url: null`, for `{ photo: null }`, for errors, and for a broken image; attributions and "Google Maps" visible; nothing photo-related written to storage; only on-screen cards trigger lookups.
- `npx tsc --noEmit` passes.
