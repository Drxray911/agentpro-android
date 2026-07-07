#!/usr/bin/env node

/**
 * Bootstrap Super Admin Script
 * Creates a super admin user in PostgreSQL during CI/CD pipeline
 * Environment variables required:
 * - DATABASE_URL: Connection string to PostgreSQL
 * - DATABASE_SSL: Whether to use SSL for database connection (default: true)
 * - SUPER_ADMIN_EMAIL: Email for the super admin account
 * - SUPER_ADMIN_PASSWORD: Password for the super admin account
 * - SUPER_ADMIN_FULL_NAME: Full name of the super admin
 * - SUPER_ADMIN_PHONE: Phone number of the super admin
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const {
  DATABASE_URL,
  DATABASE_SSL,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_FULL_NAME,
  SUPER_ADMIN_PHONE,
} = process.env;

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD',
  'SUPER_ADMIN_FULL_NAME',
  'SUPER_ADMIN_PHONE',
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingVars.join(', ')}`
  );
  process.exit(1);
}

async function bootstrapSuperAdmin() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl:
      DATABASE_SSL === 'false'
        ? false
        : {
            rejectUnauthorized: false,
          },
  });

  try {
    console.log('🚀 Starting super admin bootstrap process...');
    console.log('🔗 Connecting to PostgreSQL database...');

    await client.connect();
    console.log('✅ Connected to database');

    // Hash the password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

    console.log('📝 Creating super admin user...');
    console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`   Full Name: ${SUPER_ADMIN_FULL_NAME}`);
    console.log(`   Phone: ${SUPER_ADMIN_PHONE}`);

    // Create or update the super admin user
    const result = await client.query(
      `INSERT INTO users (email, password, full_name, phone, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
       SET password = $2, full_name = $3, phone = $4, role = $5, updated_at = NOW()
       RETURNING id, email, role`,
      [
        SUPER_ADMIN_EMAIL,
        hashedPassword,
        SUPER_ADMIN_FULL_NAME,
        SUPER_ADMIN_PHONE,
        'super_admin',
      ]
    );

    const user = result.rows[0];
    console.log('✅ Super admin user created/updated successfully!');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
  } catch (error) {
    console.error('❌ Failed to bootstrap super admin:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('   Database host not found. Check DATABASE_URL.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Is the database running?');
    } else if (error.code === '42P01') {
      console.error('   Table "users" does not exist. Check your schema.');
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

bootstrapSuperAdmin();
