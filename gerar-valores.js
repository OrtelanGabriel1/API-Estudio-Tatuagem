require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function gerarHashSenha(senha) {
  return bcrypt.hashSync(senha, 10);
}

function criptografarCpf(cpf) {
  const cifra = crypto.createCipheriv(
    "aes-256-cbc",
    process.env.CRIPTO_CHAVE,
    process.env.CRIPTO_IV,
  );
  return cifra.update(cpf, "utf-8", "hex") + cifra.final("hex");
}

console.log("Hash da senha 12345: ", gerarHashSenha("12345"));
console.log("Hash do cpf 11111111111: ", criptografarCpf("11111111111"));
console.log("Hash do cpf 22222222222: ", criptografarCpf("22222222222"));
console.log("Hash do cpf 33333333333: ", criptografarCpf("33333333333"));
