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
- Stores one current health check record per source (upserted on each check)
- Includes response times, error status, timestamps
- Uses `source_name` as unique key to prevent duplicates

### components  
- Stores individual component details for each health check
- Links to health_checks via foreign key relationship
- Refreshed completely on each health check to avoid stale data

## Data Management

- **Upsert Pattern**: Updates existing records instead of creating duplicates
- **Single Record Per Source**: Each external source has only one current record
- **Component Refresh**: Components are completely replaced on each update
- **No Manual Cleanup**: No accumulation of historical records to manage

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
- **Efficient Storage**: One record per source, updated in place

## API Endpoints

- `GET /` - Web dashboard (reads from database)
- `GET /health` - JSON summary (from database)
- `GET /health/detailed` - Detailed JSON (from database)  
- `POST /health/check` - Force immediate health check and store in database

## Performance Benefits

- **Fast Response**: Web requests read from database instead of checking external sources
- **Reliability**: Background monitoring continues even if no users are viewing the dashboard
- **Current Data**: Database always contains the most recent status for each source
- **Scalability**: Multiple application instances can share the same database
- **No Bloat**: Database size remains constant as records are updated, not accumulated