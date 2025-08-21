<?php
$password = trim(file_get_contents("/run/secrets/db_password"));
$env_file = "/var/www/backend/.env";
$content = file_get_contents($env_file);
$content = preg_replace("/^DB_PASSWORD=.*/m", "DB_PASSWORD=" . $password, $content);
file_put_contents($env_file, $content);
echo "Password updated in .env file\n";
