# Google Sheets Setup

This site already saves each submitted order in the browser using `localStorage`.

To also send orders and admin menu changes to Google Sheets:

1. Create a new Google Sheet.
2. Open `Extensions -> Apps Script`.
3. Replace the default script with this:

```javascript
function doPost(e) {
  const rawPayload = (e.parameter && e.parameter.payload) || (e.postData && e.postData.contents) || "{}";
  const data = JSON.parse(rawPayload);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (data.type === "menu_catalog") {
    const menuSheetName = "Menu Items";
    const menuSheet = spreadsheet.getSheetByName(menuSheetName) || spreadsheet.insertSheet(menuSheetName);

    menuSheet.clearContents();
    menuSheet.appendRow([
      "Updated At",
      "Item ID",
      "Item Name",
      "Price",
      "Description"
    ]);

    (data.items || []).forEach(item => {
      menuSheet.appendRow([
        data.updatedAt || "",
        item.id || "",
        item.name || "",
        item.price || "",
        item.description || ""
      ]);
    });
  } else {
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

    const itemsText = (data.items || [])
      .map(item => `${item.name} x ${item.quantity} = Rs ${item.lineTotal}`)
      .join(", ");

    sheet.appendRow([
      data.id,
      data.createdAt,
      data.customer && data.customer.name,
      data.customer && data.customer.phone,
      data.customer && data.customer.address,
      data.customer && data.customer.postcode,
      data.customer && data.customer.eventDate,
      data.customer && data.customer.notes,
      itemsText,
      data.total
    ]);
  }

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

After that:

- New orders will still be stored locally and written into date-based tabs such as `11-03-2026`, `12-03-2026`, and so on.
- Menu changes made from [admin.html](/Users/siri/Desktop/Sample_website/admin.html) will also be posted to the same Apps Script URL and written into a separate `Menu Items` tab in the same spreadsheet.

If your site is opened directly in the browser or from a static host, this project sends data to Apps Script using a regular HTML form POST instead of `fetch()`. The script above supports that by reading the `payload` field.

_github-pages-challenge-devisnamala
7fcfa388bf87712702b4fbdce4adcd
