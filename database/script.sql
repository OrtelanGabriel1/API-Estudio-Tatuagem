CREATE DATABASE IF NOT EXISTS lojaTatuagem;
USE lojaTatuagem;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL
);

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR (100)
);

CREATE TABLE projetos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    regiao VARCHAR(50) NOT NULL,
    estilo VARCHAR(50) NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projetos_id INT NOT NULL,
    data_agendamento DATETIME NOT NULL,
    FOREIGN KEY (projetos_id) REFERENCES projetos(id)
);

INSERT INTO usuarios (nome, email, senha) VALUES
("Admin", "admin@tatu.com", "$2b$10$WX4HuFLqXMmTC5FS0Qq8D.n6jkvM9FTbyMFBiU3sjYcVvu614ghi6"),
("Nilda", "nilda@tatu.com", "$2b$10$WX4HuFLqXMmTC5FS0Qq8D.n6jkvM9FTbyMFBiU3sjYcVvu614ghi6"),
("Ruth", "ruth@tatu.com", "$2b$10$WX4HuFLqXMmTC5FS0Qq8D.n6jkvM9FTbyMFBiU3sjYcVvu614ghi6");

INSERT INTO clientes (nome, cpf, telefone, email) VALUES
("Rafael Dutra", "752ad621839b3eee56832f34925fa072", "(11)11111-1111", "rafael.dutra@gmail.com"),
("Joao", "3d63b5bd4cabb9765d4dc0a193b11ada", "(11)22222-2222", "joao@gmail.com"),
("Heitor Babosa", "13e3bc7245bc3d2687139ddd0385bcee", "(11)33333-3333", "heitor.babosa@gmail.com");

INSERT INTO projetos (cliente_id, regiao, estilo) VALUES
(1, 'Perna', 'Moderno'),
(2, 'Braco', 'Minimalista'),
(3, 'Olho', 'Industrial');

INSERT INTO agendamentos (projetos_id, data_agendamento) VALUES
(1, '2026-12-01 09:00:00'),
(2, '2026-12-02 14:30:00'),
(3, '2026-12-03 10:00:00');