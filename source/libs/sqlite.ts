import sqlite3 from 'sqlite3';
import { printD } from './consoleUtils';

interface JSONValue {
    [key: string]: any;
}

class Database {
    private dbPath: string;
    private db: sqlite3.Database | null = null;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err: any) => {
                if (err) {
                    console.error('Could not connect to database', err);
                    reject(err);
                } else {
                    pppprint('Connected to database');
                    this.db!.run(`CREATE TABLE IF NOT EXISTS objects (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    );`, (err: any) => {
                        if (err) {
                            console.error('Could not create table', err);
                            reject(err);
                        } else {
                            pppprint('Database initialized');
                            resolve();
                        }
                    });
                }
            });
        });
    }

    setJSON(tableName: string, key: string, object: JSONValue): Promise<JSONValue> {
        return new Promise((resolve, reject) => {
            this.db!.run(
                `CREATE TABLE IF NOT EXISTS ${tableName} (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );`, (err: any) => {
                if (err) {
                    console.error(`Could not create table ${tableName}`, err);
                    reject(err);
                } else {
                    const jsonString = JSON.stringify(object);
                    this.db!.run(`INSERT OR REPLACE INTO ${tableName} (key, value) VALUES (?, ?);`, [key, jsonString], (err: any) => {
                        if (err) {
                            console.error('Could not add or update object', err);
                            reject(err);
                        } else {
                            pppprint('Object added or updated');

                            const firstElementKey = Object.keys(object)[0]; //costyl. otherwise it crate an extra level of structure
                            const firstElementContent = object[firstElementKey];
                            printD({"setJSON": object})
                            resolve(object);
                        }
                    });
                }
            });
        });
    }

    getJSON(tableName: string, key: string): Promise<JSONValue | null> {
        return new Promise((resolve, reject) => {
            this.db!.get(`PRAGMA table_info(${tableName});`, (err: any, row: any) => {
                if (err) {
                    console.error('Could not retrieve table info', err);
                    reject(err);
                } else {
                    if (!row) {
                        resolve(null); // Возвращаем null, если таблицы нет
                    } else {
                        this.db!.get(`SELECT value FROM ${tableName} WHERE key = ?;`, [key], (err: any, row: { value: string; }) => {
                            if (err) {
                                console.error('Could not retrieve object', err);
                                reject(err);
                            } else {
                                resolve(row ? JSON.parse(row.value) : null);
                            }
                        });
                    }
                }
            });
        });
    }

    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err: any) => {
                    if (err) {
                        console.error('Could not close database', err);
                        reject(err);
                    } else {
                        pppprint('Database closed');
                        resolve();
                    }
                });
            }
        });
    }
    getAllJSON(tableName: string): Promise<JSONValue[] | null> {
        return new Promise((resolve, reject) => {
            this.db!.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [tableName], (err: any, row: any) => {
                if (err) {
                    console.error(`Could not check table existence`, err);
                    reject(err);
                } else if (!row) {
                    resolve(null); // Если таблицы нет, верните null
                } else {
                    this.db!.all(`SELECT value FROM ${tableName};`, (err: any, rows: any[]) => {
                        if (err) {
                            console.error(`Could not retrieve objects from table ${tableName}`, err);
                            reject(err);
                        } else {
                            const allObjects = rows.map((row: { value: string; }) => JSON.parse(row.value));
                            resolve(allObjects);
                        }
                    });
                }
            });
        });
    }

    deleteRecord(tableName: string, key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db!.run(`DELETE FROM ${tableName} WHERE key = ?;`, [key], (err: any) => {
                if (err) {
                    console.error('Could not delete object', err);
                    reject(err);
                } else {
                    pppprint('Object deleted');
                    resolve();
                }
            });
        });
    }

    deleteTable(tableName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db!.run(`DROP TABLE IF EXISTS ${tableName};`, (err: any) => {
                if (err) {
                    console.error('Could not delete table', err);
                    reject(err);
                } else {
                    pppprint('Table deleted');
                    resolve();
                }
            });
        });
    }

    getTable(tableName: string): Promise<{ [key: string]: any } | null> {
        return new Promise((resolve, reject) => {
            this.db!.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [tableName], (err: any, row: any) => {
                if (err) {
                    console.error(`Could not check table existence`, err);
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    this.db!.all(`SELECT key, value FROM ${tableName};`, (err: any, rows: any[]) => {
                        if (err) {
                            console.error(`Could not retrieve objects from table ${tableName}`, err);
                            reject(err);
                        } else {
                            const keyValuePairs: { [key: string]: any } = {};
                            rows.forEach((row: { key: string; value: string; }) => {
                                keyValuePairs[row.key] = JSON.parse(row.value);
                            });
                            resolve(keyValuePairs);
                        }
                    });
                }
            });
        });
    }


    static async interact(DBpath: string, callback: (db: Database) => Promise<any>): Promise<any> {
        const db = new Database(DBpath);
        await db.init();
        const clbck = await callback(db);
        await db.close();
        return clbck;
    }

}




export default Database;

function pppprint(msg: string): void {
    if (false) console.log(msg);
}