# System Health Monitor - PostgreSQL Setup

This document explains how to set up PostgreSQL for the System Health Monitor.

## Prerequisites

1. Install PostgreSQL on your system
2. Install Node.js dependencies: `npm install`

## Database Setup

### Option 1: Create Database Manually

Connect to PostgreSQL as a superuser and run:

```sql
CREATE DATABASE system_health;
CREATE USER system_health_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE system_health TO system_health_user;
```

### Option 2: Use Environment Variables

1. Copy `.env.example` to `.env`
2. Update the database connection details in `.env`
3. The application will automatically create tables on startup

## Environment Variables

Create a `.env` file with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=system_health
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3020
```

## Database Schema

The application automatically creates these tables:

### health_checks
- Stores main health check results for each source
- Includes response times, error status, timestamps

### components  
- Stores individual component details for each health check
- Links to health_checks via foreign key relationship

## Running the Application

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Start the application: `npm start`

The application will:
- Initialize the database schema on startup
- Perform an initial health check
- Run background health checks every 5 minutes
- Serve the web dashboard on http://localhost:3020

## Features

- **Background Monitoring**: Health checks run every 5 minutes in the background
- **Database Storage**: All results are stored in PostgreSQL for performance
- **Web Dashboard**: Real-time view of health status from database
- **Manual Refresh**: Force immediate health checks via web interface
- **API Endpoints**: JSON access to health data
- **Automatic Cleanup**: Keeps last 100 checks per source to manage database size

## API Endpoints

- `GET /` - Web dashboard (reads from database)
- `GET /health` - JSON summary (from database)
- `GET /health/detailed` - Detailed JSON (from database)  
- `POST /health/check` - Force immediate health check and store in database

## Performance Benefits

- **Fast Response**: Web requests read from database instead of checking external sources
- **Reliability**: Background monitoring continues even if no users are viewing the dashboard
- **History**: Database stores historical health check data
- **Scalability**: Multiple application instances can share the same database