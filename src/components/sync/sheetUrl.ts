/** The sheet ID isn't secret: opening the link still requires the owner's Google account. */
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID ?? ""
}/edit`;
