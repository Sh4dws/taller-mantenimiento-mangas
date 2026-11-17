const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const app = express();
const puerto = 3001;
const archivo = path.join(__dirname, "mangas.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Crear el archivo de datos únicamente si todavía no existe.
if (!fs.existsSync(archivo)) {
    fs.writeFileSync(archivo, "[]", "utf8");
}

function leerMangas() {
    return JSON.parse(fs.readFileSync(archivo, "utf8"));
}

function guardarMangas(mangas) {
    fs.writeFileSync(
        archivo,
        JSON.stringify(mangas, null, 2),
        "utf8"
    );
}

function obtenerDatos(body) {
    return {
        titulo: String(body.titulo ?? "").trim(),
        autor: String(body.autor ?? "").trim(),
        genero: String(body.genero ?? "").trim(),
        tomos: Number(body.tomos),
        estado: String(body.estado ?? "").trim()
    };
}

function validarManga(manga) {
    if (!manga.titulo || !manga.autor || !manga.genero) {
        return "Completa el título, el autor y el género.";
    }

    if (!Number.isInteger(manga.tomos) || manga.tomos < 1) {
        return "Los tomos deben ser un número entero mayor que cero.";
    }

    if (!["En publicación", "Finalizado"].includes(manga.estado)) {
        return "Selecciona un estado válido.";
    }

    return null;
}

// Enviar una acción del catálogo al backend del profesor.
async function enviarEvento(action, title, payload) {
    try {
        const respuesta = await fetch("http://localhost:3000/events", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                source: "catalogo-mangas",
                entity: "manga",
                action,
                title,
                description: title,
                payload
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP ${respuesta.status}`);
        }

        const resultado = await respuesta.json();

        if (resultado.ok !== true) {
            throw new Error("El Event Manager rechazó el evento.");
        }

        return true;
    } catch (error) {
        console.error("No se pudo enviar el evento:", error.message);
        return false;
    }
}

// CONSULTAR
app.get("/api/mangas", async (req, res) => {
    const mangas = leerMangas();

    const eventoEnviado = await enviarEvento(
        "QUERY",
        "Consulta del catálogo de mangas",
        { cantidad: mangas.length }
    );

    res.json({ mangas, eventoEnviado });
});

// CREAR
app.post("/api/mangas", async (req, res) => {
    const datos = obtenerDatos(req.body ?? {});
    const error = validarManga(datos);

    if (error) {
        return res.status(400).json({ mensaje: error });
    }

    const mangas = leerMangas();
    const manga = { id: randomUUID(), ...datos };

    mangas.push(manga);
    guardarMangas(mangas);

    const eventoEnviado = await enviarEvento(
        "CREATE",
        `Manga registrado: ${manga.titulo}`,
        manga
    );

    res.status(201).json({ manga, eventoEnviado });
});

// ACTUALIZAR
app.put("/api/mangas/:id", async (req, res) => {
    const mangas = leerMangas();
    const posicion = mangas.findIndex(
        (manga) => manga.id === req.params.id
    );

    if (posicion === -1) {
        return res.status(404).json({ mensaje: "Manga no encontrado." });
    }

    const datos = obtenerDatos(req.body ?? {});
    const error = validarManga(datos);

    if (error) {
        return res.status(400).json({ mensaje: error });
    }

    const anterior = mangas[posicion];
    const actualizado = { id: anterior.id, ...datos };

    mangas[posicion] = actualizado;
    guardarMangas(mangas);

    const eventoEnviado = await enviarEvento(
        "UPDATE",
        `Manga actualizado: ${actualizado.titulo}`,
        { anterior, actualizado }
    );

    res.json({ manga: actualizado, eventoEnviado });
});

// ELIMINAR
app.delete("/api/mangas/:id", async (req, res) => {
    const mangas = leerMangas();
    const posicion = mangas.findIndex(
        (manga) => manga.id === req.params.id
    );

    if (posicion === -1) {
        return res.status(404).json({ mensaje: "Manga no encontrado." });
    }

    const [eliminado] = mangas.splice(posicion, 1);
    guardarMangas(mangas);

    const eventoEnviado = await enviarEvento(
        "DELETE",
        `Manga eliminado: ${eliminado.titulo}`,
        eliminado
    );

    res.json({ manga: eliminado, eventoEnviado });
});

// Responder ante errores sin dejar la solicitud sin respuesta.
app.use((error, req, res, next) => {
    console.error(error.message);

    const estado = error.status === 400 ? 400 : 500;

    res.status(estado).json({
        mensaje: estado === 400
            ? "El JSON enviado no es válido."
            : "Ocurrió un error al procesar la solicitud."
    });
});

app.listen(puerto, () => {
    console.log(`Catálogo de mangas: http://localhost:${puerto}`);
});