require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const defaultJwtSecret = 'football-secret-key';
const jwtSecret = process.env.JWT_SECRET || defaultJwtSecret;

if (isProduction && (jwtSecret === defaultJwtSecret || jwtSecret.length < 32)) {
  throw new Error('В production необходимо задать JWT_SECRET длиной не менее 32 символов');
}

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  JWT_SECRET: jwtSecret,
  dbConfig: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'football_demo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
  },
};
