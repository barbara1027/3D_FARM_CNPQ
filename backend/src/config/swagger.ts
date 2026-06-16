import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "3D Farm API",
      version: "2.0.0",
      description: "API da plataforma 3D Farm — pedidos de impressão 3D on-demand.",
    },
    servers: [
      { url: "http://localhost:3333", description: "Desenvolvimento local" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT obtido em POST /auth/login",
        },
      },
      schemas: {
        LoginDTO: {
          type: "object",
          required: ["email", "senha"],
          properties: {
            email: { type: "string", format: "email", example: "admin@3dfarm.com" },
            senha: { type: "string", example: "123456" },
          },
        },

        UsuarioPublico: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            email: { type: "string", format: "email" },
            tipo: { type: "string", enum: ["admin", "cliente"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateUsuarioDTO: {
          type: "object",
          required: ["nome", "email", "senha"],
          properties: {
            nome: { type: "string", example: "João Silva" },
            email: { type: "string", format: "email", example: "joao@email.com" },
            senha: { type: "string", example: "minhasenha123" },
            tipo: { type: "string", enum: ["admin", "cliente"], default: "cliente" },
          },
        },
        UpdateUsuarioDTO: {
          type: "object",
          properties: {
            nome: { type: "string" },
            email: { type: "string", format: "email" },
            senha: { type: "string" },
            tipo: { type: "string", enum: ["admin", "cliente"] },
          },
        },

        Material: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            tipo: { type: "string", example: "PLA" },
            preco: { type: "number", format: "float", description: "Preço por grama (R$)" },
            status: { type: "string", enum: ["disponivel", "indisponivel"] },
            cor: { type: "string", example: "Branco" },
          },
        },
        CreateMaterialDTO: {
          type: "object",
          required: ["nome", "tipo", "preco", "status"],
          properties: {
            nome: { type: "string", example: "PLA Branco" },
            tipo: { type: "string", example: "PLA" },
            preco: { type: "number", example: 0.12 },
            status: { type: "string", enum: ["disponivel", "indisponivel"] },
            cor: { type: "string", example: "Branco" },
          },
        },
        UpdateMaterialDTO: {
          type: "object",
          properties: {
            nome: { type: "string" },
            tipo: { type: "string" },
            preco: { type: "number" },
            status: { type: "string", enum: ["disponivel", "indisponivel"] },
            cor: { type: "string" },
          },
        },

        QualidadeImpressao: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string", example: "Normal" },
            altura: { type: "number", format: "float", example: 0.2 },
            espessura: { type: "number", format: "float", example: 1.2 },
            preenchimento: { type: "integer", example: 20 },
            velocidade: { type: "integer", example: 60 },
            temperaturaBico: { type: "integer", example: 210 },
            temperaturaMesa: { type: "integer", example: 60 },
            suporte: { type: "integer", enum: [0, 1] },
            adesao: { type: "integer", enum: [0, 1] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateQualidadeDTO: {
          type: "object",
          required: ["altura", "espessura", "preenchimento", "velocidade", "temperaturaBico", "temperaturaMesa", "suporte", "adesao"],
          properties: {
            nome: { type: "string", example: "Custom" },
            altura: { type: "number", example: 0.2 },
            espessura: { type: "number", example: 1.2 },
            preenchimento: { type: "integer", example: 20 },
            velocidade: { type: "integer", example: 60 },
            temperaturaBico: { type: "integer", example: 210 },
            temperaturaMesa: { type: "integer", example: 60 },
            suporte: { type: "integer", enum: [0, 1], example: 0 },
            adesao: { type: "integer", enum: [0, 1], example: 0 },
          },
        },
        UpdateQualidadeDTO: {
          type: "object",
          properties: {
            nome: { type: "string" },
            altura: { type: "number" },
            espessura: { type: "number" },
            preenchimento: { type: "integer" },
            velocidade: { type: "integer" },
            temperaturaBico: { type: "integer" },
            temperaturaMesa: { type: "integer" },
            suporte: { type: "integer", enum: [0, 1] },
            adesao: { type: "integer", enum: [0, 1] },
          },
        },

        Arquivo: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            tipo: { type: "string", enum: ["stl", "gcode"] },
            caminho: { type: "string" },
            tamanhoMb: { type: "number", format: "float" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        Pedido: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            preco: { type: "number", format: "float" },
            descricao: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["na_fila", "em_impressao", "concluido", "falhou", "cancelado"],
            },
            idUsuario: { type: "integer" },
            idMaterial: { type: "integer" },
            idQualidade: { type: "integer" },
            idArquivo: { type: "integer" },
            nomeUsuario: { type: "string" },
            emailUsuario: { type: "string" },
            nomeMaterial: { type: "string" },
            nomeArquivo: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreatePedidoDTO: {
          type: "object",
          required: ["nome", "preco", "idMaterial", "idQualidade", "idArquivo"],
          properties: {
            nome: { type: "string", example: "Suporte de câmera" },
            preco: { type: "number", example: 45.90 },
            descricao: { type: "string" },
            idMaterial: { type: "integer", example: 1 },
            idQualidade: { type: "integer", example: 1 },
            idArquivo: { type: "integer", example: 1 },
          },
        },
        UpdatePedidoDTO: {
          type: "object",
          properties: {
            preco: { type: "number" },
            descricao: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["na_fila", "em_impressao", "concluido", "falhou", "cancelado"],
            },
            idMaterial: { type: "integer" },
            idQualidade: { type: "integer" },
            idArquivo: { type: "integer" },
          },
        },

        Impressora: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            modelo: { type: "string" },
            status: {
              type: "string",
              enum: ["Ociosa", "Reservada", "Imprimindo", "Pausada", "Indisponivel", "Aguardando Remoção", "Erro", "Manutenção"],
            },
            ip: { type: "string", nullable: true },
            baseUrl: { type: "string", nullable: true },
            api: { type: "string", enum: ["OCTOPRINT", "MOONRAKER", "DUMMY"] },
            api_key: { type: "string", nullable: true },
            timeoutMs: { type: "integer" },
            statusFisico: { type: "string", nullable: true },
            jobRemotoId: { type: "string", nullable: true },
            ultimoErro: { type: "string", nullable: true },
            ultimaSincronizacao: { type: "string", nullable: true },
            idMaterial: { type: "integer", nullable: true },
          },
        },
        CreateImpressoraDTO: {
          type: "object",
          required: ["nome", "modelo", "api"],
          properties: {
            nome: { type: "string", example: "Ender 3 Pro" },
            modelo: { type: "string", example: "Creality Ender 3 Pro" },
            api: { type: "string", enum: ["OCTOPRINT", "MOONRAKER", "DUMMY"], example: "DUMMY" },
            ip: { type: "string", example: "192.168.1.100", nullable: true },
            baseUrl: { type: "string", example: "http://192.168.1.100", nullable: true },
            api_key: { type: "string", nullable: true },
            timeoutMs: { type: "integer", example: 15000 },
            idMaterial: { type: "integer", nullable: true },
          },
        },
        UpdateImpressoraDTO: {
          type: "object",
          properties: {
            nome: { type: "string" },
            modelo: { type: "string" },
            status: { type: "string", enum: ["Ociosa", "Reservada", "Imprimindo", "Pausada", "Indisponivel", "Aguardando Remoção", "Erro", "Manutenção"] },
            ip: { type: "string", nullable: true },
            baseUrl: { type: "string", nullable: true },
            api: { type: "string", enum: ["OCTOPRINT", "MOONRAKER", "DUMMY"] },
            api_key: { type: "string", nullable: true },
            timeoutMs: { type: "integer" },
            idMaterial: { type: "integer", nullable: true },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "Autenticação e sessão" },
      { name: "Usuários", description: "Gerenciamento de usuários" },
      { name: "Materiais", description: "Gerenciamento de materiais de impressão" },
      { name: "Qualidades", description: "Presets de qualidade de impressão" },
      { name: "Arquivos", description: "Upload e gerenciamento de arquivos STL e G-code" },
      { name: "Pedidos", description: "Pedidos de impressão 3D" },
      { name: "Impressoras", description: "Gerenciamento e comunicação com impressoras" },
    ],
  },
  apis: ["./src/modules/**/*.controller.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
