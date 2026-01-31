/**
 * Pass Profile Types
 * 
 * Profile-driven configuration for booking behaviour.
 * Stored in Portal DB, backend maps field names for API exposure.
 */

/**
 * @typedef {'instant' | 'date_select' | 'datetime_select' | 'duration_select'} ProfileType
 */

/**
 * @typedef {'date' | 'time' | 'duration' | 'nights'} RequiredInput
 */

/**
 * @typedef {Object} DurationOption
 * @property {string} label - Display label (e.g., "1 hour")
 * @property {number} minutes - Duration in minutes
 */

/**
 * @typedef {Object} PassProfile
 * @property {string} id - UUID
 * @property {string} site_id - Foreign key to sites
 * @property {string} code - Unique code per site (e.g., 'end_of_day', 'hourly_slot')
 * @property {string} name - Display name
 * @property {ProfileType} profile_type - Type of profile
 * @property {number|null} duration_minutes - Fixed duration for profiles
 * @property {DurationOption[]} duration_options - Selectable durations
 * @property {string|null} checkout_time - Time for overnight stays (e.g., '10:00')
 * @property {number} entry_buffer_minutes - Buffer before pass validity (API: buffer_before_minutes)
 * @property {number} exit_buffer_minutes - Buffer after pass validity (API: buffer_after_minutes)
 * @property {number} reset_buffer_minutes - Time between consecutive bookings
 * @property {RequiredInput[]} required_inputs - What PWA needs to collect
 * @property {boolean} future_booking_enabled - Allow future date selection
 * @property {boolean} availability_enforcement - Check slot availability
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 */

/**
 * @typedef {Object} PassProfileFormData
 * @property {string} site_id
 * @property {string} code
 * @property {string} name
 * @property {ProfileType} profile_type
 * @property {number|null} [duration_minutes]
 * @property {DurationOption[]} [duration_options]
 * @property {string|null} [checkout_time]
 * @property {number} [entry_buffer_minutes]
 * @property {number} [exit_buffer_minutes]
 * @property {number} [reset_buffer_minutes]
 * @property {RequiredInput[]} [required_inputs]
 * @property {boolean} [future_booking_enabled]
 * @property {boolean} [availability_enforcement]
 */

/** @type {ProfileType[]} */
export const PROFILE_TYPES = [
  'instant',
  'date_select',
  'datetime_select',
  'duration_select',
]

/** @type {Object<ProfileType, string>} */
export const PROFILE_TYPE_LABELS = {
  instant: 'Instant (No Selection)',
  date_select: 'Date Selection',
  datetime_select: 'Date & Time Selection',
  duration_select: 'Duration Selection',
}

/** @type {RequiredInput[]} */
export const REQUIRED_INPUT_OPTIONS = [
  'date',
  'time',
  'duration',
  'nights',
]

/** @type {Object<RequiredInput, string>} */
export const REQUIRED_INPUT_LABELS = {
  date: 'Date',
  time: 'Time',
  duration: 'Duration',
  nights: 'Number of Nights',
}

/**
 * Default values for a new profile
 * @type {PassProfileFormData}
 */
export const DEFAULT_PROFILE_VALUES = {
  site_id: '',
  code: '',
  name: '',
  profile_type: 'instant',
  duration_minutes: null,
  duration_options: [],
  checkout_time: null,
  entry_buffer_minutes: 0,
  exit_buffer_minutes: 0,
  reset_buffer_minutes: 0,
  required_inputs: [],
  future_booking_enabled: false,
  availability_enforcement: false,
}
