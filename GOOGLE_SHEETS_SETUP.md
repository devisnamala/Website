# Google Sheets Setup

This site already saves each submitted order in the browser using `localStorage`.

To also send orders to Google Sheets:

1. Create a new Google Sheet.
2. Open `Extensions -> Apps Script`.
3. Replace the default script with this:

```javascript
function doPost(e) {
  const rawPayload = (e.parameter && e.parameter.payload) || (e.postData && e.postData.contents) || "{}";
  const data = JSON.parse(rawPayload);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDate = data.customer && data.customer.eventDate
    ? new Date(data.customer.eventDate)
    : new Date();
  const timezone = Session.getScriptTimeZone();
  const sheetName = Utilities.formatDate(sheetDate, timezone, "dd-MM-yyyy");
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Order ID",
      "Created At",
      "Customer Name",
      "Phone",
      "Address",
      "Postcode",
      "Event Date",
      "Notes",
      "Items",
      "Total"
    ]);
  }

  const itemsText = data.items
    .map(item => `${item.name} x ${item.quantity} = Rs ${item.lineTotal}`)
    .join(", ");

  sheet.appendRow([
    data.id,
    data.createdAt,
    data.customer.name,
    data.customer.phone,
    data.customer.address,
    data.customer.postcode,
    data.customer.eventDate,
    data.customer.notes,
    itemsText,
    data.total
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Click `Deploy -> New deployment`.
5. Choose `Web app`.
6. Set access to `Anyone`.
7. Copy the web app URL.
8. Open [script.js](/Users/siri/Desktop/Sample_website/script.js) and set `GOOGLE_SHEETS_WEBHOOK_URL` to that URL.

After that, new orders will be stored locally and also posted to Google Sheets. Each date gets its own tab, for example `11-03-2026`, `12-03-2026`, and so on.

If your site is opened directly in the browser or from a static host, this project sends data to Apps Script using a regular HTML form POST instead of `fetch()`. The script above supports that by reading the `payload` field.
