import dotenv from 'dotenv';
import mysql from 'mysql2';

dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('Fehler bei der Verbindung:', err);
    return;
  }
  console.log('Mit MySQL verbunden!');
});

export default connection;
