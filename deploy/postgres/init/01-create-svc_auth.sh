#!/bin/sh
# Crée la base applicative + l'utilisateur dédié au premier démarrage.
# (Ne s'exécute QUE si le volume de données est vide.)
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE USER "$SVC_AUTH_USER" WITH PASSWORD '$SVC_AUTH_PASSWORD';
  CREATE DATABASE "$SVC_AUTH_DB" OWNER "$SVC_AUTH_USER";
EOSQL

# PG15+ : le schéma public n'est plus ouvert par défaut -> on en donne la
# propriété à l'utilisateur applicatif pour qu'il puisse créer ses tables.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$SVC_AUTH_DB" <<-EOSQL
  GRANT ALL ON SCHEMA public TO "$SVC_AUTH_USER";
  ALTER SCHEMA public OWNER TO "$SVC_AUTH_USER";
EOSQL
