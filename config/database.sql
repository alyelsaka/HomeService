CREATE DATABASE IF NOT EXISTS home_services;
USE home_services;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    user_type ENUM('admin', 'worker', 'client') NOT NULL,
    status ENUM('pending', 'active', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE worker_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    service_type ENUM('plumber', 'electrician', 'cleaner') NOT NULL,
    experience_years INT,
    status ENUM('available', 'busy') DEFAULT 'available',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE service_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT,
    worker_id INT,
    service_type ENUM('plumber', 'electrician', 'cleaner') NOT NULL,
    description TEXT,
    status ENUM('pending', 'accepted', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id),
    FOREIGN KEY (worker_id) REFERENCES users(id)
);