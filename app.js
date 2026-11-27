
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cookieparser = require("cookie-parser");
const Mustache = require("mustache");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(cookieparser());

// =================================== MÉTODOS HTTP =================================== //
app.use((req, res, next) => {
  const metodo = String(req.body?._method || "").toUpperCase();

  if (req.method === "POST" && ["PUT", "DELETE"].includes(metodo)) {
    req.method = metodo;
  }

  next();
});

// =================================== BANCO DE DADOS =================================== //
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
});

// =================================== FUNÇÕES INICIAIS =================================== //
function mostrar(nome, dados = {}) {
  const arquivo = path.join(__dirname, "paginas", `${nome}.html`);
  return Mustache.render(fs.readFileSync(arquivo, "utf-8"), dados);
}

// =================================== CRIPTOGRAFIA =================================== //
function criptografar(texto) {
  const cifra = crypto.createCipheriv(
    "aes-256-cbc",
    process.env.CRIPTO_CHAVE,
    process.env.CRIPTO_IV
  );

  return cifra.update(texto, "utf-8", "hex") + cifra.final("hex");
}

function descriptografar(texto) {
  try {
    const decifra = crypto.createDecipheriv(
      "aes-256-cbc",
      process.env.CRIPTO_CHAVE,
      process.env.CRIPTO_IV
    );

    return decifra.update(texto, "hex", "utf-8") + decifra.final("utf-8");
  } catch (erro) {
    return "CPF indisponível";
  }
}

// =================================== EXCLUSÃO GENÉRICA =================================== //
async function excluir(res, tabela, id, volta, motivo) {
  try {
    await db.query(`DELETE FROM ${tabela} WHERE id = ?`, [id]);
    res.redirect(volta);
  } catch (erro) {
    if (erro.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).send(
        `<p>Não foi possível excluir: ${motivo}</p>
         <p><a href="${volta}">Voltar</a></p>`
      );
    }

    console.error(erro);

    res.status(500).send(
      `<p>Erro ao excluir.</p>
       <p><a href="${volta}">Voltar</a></p>`
    );
  }
}

// =================================== EXIBIR PROJETOS =================================== //
async function mostrarProjetos(req, res, erro = "") {
  const [projetos] = await db.query(`
    SELECT projetos.*, clientes.nome AS cliente_nome
    FROM projetos
    JOIN clientes ON clientes.id = projetos.cliente_id
    ORDER BY projetos.id
  `);

  const [listaClientes] = await db.query(
    "SELECT id, nome FROM clientes ORDER BY nome"
  );

  const editar = projetos.find(
    (p) => String(p.id) === req.query.editar
  );

  const clientes = listaClientes.map((cliente) => ({
    ...cliente,
    selecionado:
      editar && cliente.id === editar.cliente_id ? "selected" : "",
  }));

  res.send(
    mostrar("projetos", {
      projetos,
      clientes,
      erro,
      editando: Boolean(editar),
      acao: editar ? `/projetos/${editar.id}` : "/projetos",
      form: editar || {},
    })
  );
}

// =================================== EXIBIR AGENDAMENTOS =================================== //
async function mostrarAgendamentos(req, res, erro = "") {
  const [lista] = await db.query(`
    SELECT
      agendamentos.*,
      projetos.regiao,
      projetos.estilo,
      clientes.nome AS cliente_nome,
      projetos.id AS projeto_id
    FROM agendamentos
    JOIN projetos ON projetos.id = agendamentos.projetos_id
    JOIN clientes ON clientes.id = projetos.cliente_id
    ORDER BY agendamentos.data_agendamento
  `);

  const [projetos] = await db.query(`
    SELECT
      projetos.id,
      projetos.regiao,
      projetos.estilo,
      clientes.nome AS cliente_nome
    FROM projetos
    JOIN clientes ON clientes.id = projetos.cliente_id
    ORDER BY clientes.nome
  `);

  const editar = lista.find(
    (a) => String(a.id) === req.query.editar
  );

  const projetosSelect = projetos.map((p) => ({
    ...p,
    selecionado:
      editar && editar.projetos_id === p.id ? "selected" : "",
  }));

  const agendamentos = lista.map((a) => ({
    ...a,
    data_br: a.data_agendamento
      ? new Date(a.data_agendamento.replace(" ", "T")).toLocaleString("pt-BR")
      : "",
    data_input: a.data_agendamento
      ? a.data_agendamento.slice(0, 16).replace(" ", "T")
      : "",
  }));

  res.send(
    mostrar("agendamentos", {
      agendamentos,
      projetos: projetosSelect,
      erro,
      editando: Boolean(editar),
      acao: editar ? `/agendamentos/${editar.id}` : "/agendamentos",
      form: editar
        ? {
            ...editar,
            data_input: editar.data_agendamento
              ? editar.data_agendamento.slice(0, 16).replace(" ", "T")
              : "",
          }
        : {},
    })
  );
}

// =================================== LOGIN =================================== //
app.get("/", (req, res) => {
  res.send(mostrar("login"));
});

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    const [usuarios] = await db.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    );

    const usuario = usuarios[0];

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.send(
        mostrar("login", { erro: "E-mail ou senha inválidos." })
      );
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, { httpOnly: true });
    res.redirect("/principal");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao realizar login.");
  }
});

// =================================== SAIR =================================== //
app.post("/sair", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// =================================== AUTENTICAÇÃO =================================== //
app.use((req, res, next) => {
  try {
    req.usuario = jwt.verify(
      req.cookies.token,
      process.env.JWT_SECRET
    );

    next();
  } catch (erro) {
    res.redirect("/");
  }
});

// =================================== PRINCIPAL =================================== //
app.get("/principal", (req, res) => {
  res.send(
    mostrar("principal", { nome: req.usuario.nome })
  );
});

// =================================== CLIENTES =================================== //
app.get("/clientes", async (req, res) => {
  try {
    const busca = req.query.busca || "";

    const [lista] = await db.query(
      "SELECT * FROM clientes WHERE nome LIKE ? ORDER BY nome",
      [`%${busca}%`]
    );

    const clientes = lista.map((cliente) => ({
      ...cliente,
      cpf: descriptografar(cliente.cpf),
    }));

    const editar = clientes.find(
      (cliente) => String(cliente.id) === req.query.editar
    );

    res.send(
      mostrar("clientes", {
        busca,
        clientes,
        editando: Boolean(editar),
        acao: editar ? `/clientes/${editar.id}` : "/clientes",
        form: editar || {},
      })
    );
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar clientes.");
  }
});

app.post("/clientes", async (req, res) => {
  try {
    const { nome, cpf, telefone, email } = req.body;

    await db.query(
      "INSERT INTO clientes (nome, cpf, telefone, email) VALUES (?, ?, ?, ?)",
      [nome, criptografar(cpf), telefone || null, email || null]
    );

    res.redirect("/clientes");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao cadastrar cliente.");
  }
});

app.put("/clientes/:id", async (req, res) => {
  try {
    const { nome, cpf, telefone, email } = req.body;

    await db.query(
      "UPDATE clientes SET nome = ?, cpf = ?, telefone = ?, email = ? WHERE id = ?",
      [
        nome,
        criptografar(cpf),
        telefone || null,
        email || null,
        req.params.id,
      ]
    );

    res.redirect("/clientes");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao atualizar cliente.");
  }
});

app.delete("/clientes/:id", async (req, res) => {
  await excluir(
    res,
    "clientes",
    req.params.id,
    "/clientes",
    "O cliente possui projetos de tatuagem cadastrados."
  );
});

// =================================== PROJETOS =================================== //
app.get("/projetos", async (req, res) => {
  try {
    await mostrarProjetos(req, res);
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar projetos.");
  }
});

app.post("/projetos", async (req, res) => {
  try {
    const { cliente_id, regiao, estilo } = req.body;

    if (!cliente_id) {
      return mostrarProjetos(req, res, "Selecione um cliente.");
    }

    await db.query(
      "INSERT INTO projetos (cliente_id, regiao, estilo) VALUES (?, ?, ?)",
      [cliente_id, regiao, estilo]
    );

    res.redirect("/projetos");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao cadastrar projeto.");
  }
});

app.put("/projetos/:id", async (req, res) => {
  try {
    const { cliente_id, regiao, estilo } = req.body;

    if (!cliente_id) {
      return mostrarProjetos(req, res, "Selecione um cliente.");
    }

    await db.query(
      "UPDATE projetos SET cliente_id = ?, regiao = ?, estilo = ? WHERE id = ?",
      [cliente_id, regiao, estilo, req.params.id]
    );

    res.redirect("/projetos");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao atualizar projeto.");
  }
});

app.delete("/projetos/:id", async (req, res) => {
  await excluir(
    res,
    "projetos",
    req.params.id,
    "/projetos",
    "O projeto possui agendamentos cadastrados."
  );
});

// =================================== AGENDAMENTOS =================================== //
app.get("/agendamentos", async (req, res) => {
  try {
    await mostrarAgendamentos(req, res);
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar agendamentos.");
  }
});

app.post("/agendamentos", async (req, res) => {
  try {
    const { projetos_id, data_agendamento } = req.body;

    if (!projetos_id || !data_agendamento) {
      return mostrarAgendamentos(
        req,
        res,
        "Projeto e data do agendamento são obrigatórios."
      );
    }

    await db.query(
      "INSERT INTO agendamentos (projetos_id, data_agendamento) VALUES (?, ?)",
      [projetos_id, data_agendamento.replace("T", " ")]
    );

    res.redirect("/agendamentos");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao cadastrar agendamento.");
  }
});

app.put("/agendamentos/:id", async (req, res) => {
  try {
    const { projetos_id, data_agendamento } = req.body;

    if (!projetos_id || !data_agendamento) {
      return mostrarAgendamentos(
        req,
        res,
        "Projeto e data do agendamento são obrigatórios."
      );
    }

    await db.query(
      "UPDATE agendamentos SET projetos_id = ?, data_agendamento = ? WHERE id = ?",
      [
        projetos_id,
        data_agendamento.replace("T", " "),
        req.params.id,
      ]
    );

    res.redirect("/agendamentos");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao atualizar agendamento.");
  }
});

app.delete("/agendamentos/:id", async (req, res) => {
  await excluir(
    res,
    "agendamentos",
    req.params.id,
    "/agendamentos",
    " "
  );
});

// =================================== SERVIDOR =================================== //
const porta = process.env.PORT || 3000;

app.listen(porta, () => {
  console.log(`Loja de tatuagem rodando em http://localhost:${porta}`);
});
