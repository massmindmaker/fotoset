#!/bin/bash
# Run Migration 048: Dual Referral Codes
# Usage: ./scripts/run-migration-048.sh

echo "Running Migration 048: Dual Referral Codes..."

# Check if neonctl is installed
if ! command -v neonctl &> /dev/null; then
    echo "ERROR: neonctl is not installed. Please install it first:"
    echo "npm install -g neonctl"
    exit 1
fi

# Get connection string from Neon CLI
echo "Getting connection string from Neon..."
CONN_STRING=$(neonctl connection-string --pool-mode transaction)

if [ -z "$CONN_STRING" ]; then
    echo "ERROR: Failed to get connection string from Neon"
    exit 1
fi

echo "Executing migration 048..."

# Run migration using psql
psql "$CONN_STRING" -f scripts/migrations/048_dual_referral_codes.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration 048 completed successfully!"
    echo ""
    echo "Verification queries:"
    echo "1. Check new columns exist:"
    echo "   SELECT column_name FROM information_schema.columns WHERE table_name = 'referral_balances' AND column_name LIKE 'referral_code%';"
    echo ""
    echo "2. Check indexes:"
    echo "   SELECT indexname FROM pg_indexes WHERE tablename = 'referral_balances' AND indexname LIKE 'idx_referral%';"
    echo ""
    echo "3. Check migrated codes:"
    echo "   SELECT user_id, referral_code, referral_code_telegram, referral_code_web FROM referral_balances LIMIT 5;"
else
    echo "❌ Migration 048 failed!"
    exit 1
fi
