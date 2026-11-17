const formulario = document.getElementById("formulario");
const lista = document.getElementById("lista-mangas");
const mensaje = document.getElementById("mensaje");
const guardar = document.getElementById("guardar");
const cancelar = document.getElementById("cancelar");
const consultar = document.getElementById("consultar");

const titulo = document.getElementById("titulo");
const autor = document.getElementById("autor");
const genero = document.getElementById("genero");
const tomos = document.getElementById("tomos");
const estado = document.getElementById("estado");

let idEdicion = null;
let procesando = false;

// Hacer una solicitud al servidor del catálogo.
async function solicitar(url, metodo = "GET", datos) {
    const opciones = { method: metodo };

    if (datos !== undefined) {
        opciones.headers = { "Content-Type": "application/json" };
        opciones.body = JSON.stringify(datos);
    }

    const respuesta = await fetch(url, opciones);
    const resultado = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(resultado.mensaje || "La operación falló.");
    }

    return resultado;
}

function mostrarResultado(texto, eventoEnviado) {
    mensaje.textContent = eventoEnviado
        ? `${texto} El Event Manager aceptó el evento.`
        : `${texto} Aviso: no se pudo enviar el evento al Event Manager.`;
}

function limpiarFormulario() {
    idEdicion = null;
    formulario.reset();
    document.getElementById("titulo-formulario").textContent =
        "Registrar manga";
    guardar.textContent = "Registrar";
    cancelar.hidden = true;
}

function editarManga(manga) {
    idEdicion = manga.id;
    titulo.value = manga.titulo;
    autor.value = manga.autor;
    genero.value = manga.genero;
    tomos.value = manga.tomos;
    estado.value = manga.estado;

    document.getElementById("titulo-formulario").textContent =
        "Editar manga";
    guardar.textContent = "Guardar cambios";
    cancelar.hidden = false;

    titulo.focus();
}

function mostrarMangas(mangas) {
    lista.replaceChildren();

    if (mangas.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 6;
        celda.textContent = "Todavía no hay mangas registrados.";

        fila.appendChild(celda);
        lista.appendChild(fila);
        return;
    }

    mangas.forEach((manga) => {
        const fila = document.createElement("tr");

        const valores = [
            manga.titulo,
            manga.autor,
            manga.genero,
            manga.tomos,
            manga.estado
        ];

        valores.forEach((valor) => {
            const celda = document.createElement("td");
            celda.textContent = valor;
            fila.appendChild(celda);
        });

        const acciones = document.createElement("td");

        const editar = document.createElement("button");
        editar.type = "button";
        editar.textContent = "Editar";
        editar.disabled = procesando;
        editar.addEventListener("click", () => editarManga(manga));

        const eliminar = document.createElement("button");
        eliminar.type = "button";
        eliminar.textContent = "Eliminar";
        eliminar.className = "eliminar";
        eliminar.disabled = procesando;
        eliminar.addEventListener("click", () => eliminarManga(manga));

        acciones.append(editar, eliminar);
        fila.appendChild(acciones);
        lista.appendChild(fila);
    });
}

function bloquearBotones(bloquear) {
    procesando = bloquear;

    document.querySelectorAll("button").forEach((boton) => {
        boton.disabled = bloquear;
    });
}

async function cargarMangas() {
    const resultado = await solicitar("/api/mangas");
    mostrarMangas(resultado.mangas);
    return resultado;
}

// CREAR o ACTUALIZAR, según estemos registrando o editando.
formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (procesando) return;

    const datos = {
        titulo: titulo.value.trim(),
        autor: autor.value.trim(),
        genero: genero.value.trim(),
        tomos: Number(tomos.value),
        estado: estado.value
    };

    const editando = idEdicion !== null;
    const url = editando
        ? `/api/mangas/${idEdicion}`
        : "/api/mangas";

    bloquearBotones(true);
    mensaje.textContent = "Guardando manga…";

    try {
        const resultado = await solicitar(
            url,
            editando ? "PUT" : "POST",
            datos
        );

        limpiarFormulario();

        mostrarResultado(
            editando ? "Manga actualizado." : "Manga registrado.",
            resultado.eventoEnviado
        );

        // Actualizar la tabla también realiza una consulta.
        try {
            const consulta = await cargarMangas();

            if (!consulta.eventoEnviado) {
                mensaje.textContent +=
                    " El evento de actualización de la lista no pudo enviarse.";
            }
        } catch (error) {
            mensaje.textContent +=
                ` No se pudo actualizar la lista: ${error.message}`;
        }
    } catch (error) {
        mensaje.textContent = error.message;
    } finally {
        bloquearBotones(false);
    }
});

// ELIMINAR
async function eliminarManga(manga) {
    if (procesando) return;

    const confirmado = confirm(`¿Eliminar "${manga.titulo}"?`);
    if (!confirmado) return;

    bloquearBotones(true);
    mensaje.textContent = "Eliminando manga…";

    try {
        const resultado = await solicitar(
            `/api/mangas/${manga.id}`,
            "DELETE"
        );

        if (idEdicion === manga.id) {
            limpiarFormulario();
        }

        mostrarResultado("Manga eliminado.", resultado.eventoEnviado);

        try {
            const consulta = await cargarMangas();

            if (!consulta.eventoEnviado) {
                mensaje.textContent +=
                    " El evento de actualización de la lista no pudo enviarse.";
            }
        } catch (error) {
            mensaje.textContent +=
                ` No se pudo actualizar la lista: ${error.message}`;
        }
    } catch (error) {
        mensaje.textContent = error.message;
    } finally {
        bloquearBotones(false);
    }
}

// CONSULTAR
async function consultarMangas() {
    if (procesando) return;

    bloquearBotones(true);
    mensaje.textContent = "Consultando mangas…";

    try {
        const resultado = await cargarMangas();
        mostrarResultado("Catálogo consultado.", resultado.eventoEnviado);
    } catch (error) {
        mensaje.textContent = error.message;
    } finally {
        bloquearBotones(false);
    }
}

consultar.addEventListener("click", consultarMangas);
cancelar.addEventListener("click", limpiarFormulario);

// Consultar el catálogo al abrir la página.
consultarMangas();