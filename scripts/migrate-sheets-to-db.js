const store = require('../modules/server/sheet-store');
const { migrateAll } = require('../modules/server/migrate');

store.openDatabase(process.env.SHEETS_DB);
const result = migrateAll({ dbPath: process.env.SHEETS_DB });
console.log(`Database: ${store.getDbPath()}`);
console.log(`Imported ${result.imported} sheets, ${result.bookmarks} bookmarks`);
store.closeDatabase();
