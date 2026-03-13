import bcrypt from "bcrypt";
import{
    UsuarioRepositiry,
    Usuario,
    UsuarioTipo,
} from "./usuarios.repository";

export interface CreateUsuarioServiceDTO {
    nome: string;
    email: string;
    senha: string;
    tipo: UsuarioTipo;
}

export interface UpdateUsuarioServiceDTO{
    nome?: string;
    email?: string;
    senha?: string;
    tipo?: UsuarioTipo;
}

export class UsuarioService{
    constructor(private readonly usuarioRepository: UsuarioRepositiry){}

    async listar(): Promise<Omit<Usuario, "senha_hash">[]> {
        const usuarios = await this.usuarioRepository.findAll();

        return usuarios.map(({ senha_hash, ...usuario }) => usuario);
    }

    async buscaPorId(id: number): Promise<Omit<Usuario, "senha_hash"> | null> {
        const usuario = await this.usuarioRepository.findById(id);

        if(!usuario){
            return null;
        }

        const {senha_hash, ...usuariosemsenha} = usuario;
        return usuariosemsenha;
    }
    
    async criar(data:CreateUsuarioServiceDTO){
        const usuarioExistente = await this.usuarioRepository.findByemail(data.email);

        if(usuarioExistente){
            throw new Error("Já existe um usuário com este email.");
        }

        const senhaHash = await bcrypt.hash(data.senha, 10);

        const id = await this.usuarioRepository.create({
            nome: data.nome,
            email: data.email,
            senhaHash,
            tipo: data.tipo,
        });

        const usuarioCriado = await this.usuarioRepository.findById(id);

        if(!usuarioCriado){
            throw new Error("Erro ao buscar usuário recém criado.");
        }

        const {senha_hash, ...usuarioSemsenha} = usuarioCriado;
        return usuarioSemsenha;
    }

    async atualizar(id:number,data:UpdateUsuarioServiceDTO){
        const usuario = await this.usuarioRepository.findById(id);

        if(!usuario){   
            throw new Error("Usuário não encontrado.");
        }

        if(data.email && data.email !== usuario.email){
            const emailEmUso = await this.usuarioRepository.findByemail(data.email);
            if(emailEmUso){
                throw new Error("Este email já está em uso.");
            }
        }

        let senhaHash: string | undefined;
        if(data.senha){
            senhaHash = await bcrypt.hash(data.senha, 10);
        }

        await this.usuarioRepository.update(id,{
            nome: data.nome,
            email: data.email,
            senhaHash,
            tipo: data.tipo,
        });

        const usuarioAtualizado = await this.usuarioRepository.findById(id);

        if(!usuarioAtualizado){
            throw new Error("Error ao buscar usuário atualizado");
        }

        const {senha_hash, ...usuarioSemSenha} = usuarioAtualizado;
        return usuarioSemSenha;
    }
    

    async remover(id: number) {
        const usuario = await this.usuarioRepository.findById(id);

        if(!usuario){
            throw new Error("Usuário não encontrado");          
        }

        await this.usuarioRepository.delete(id);

        return { message: "Usuário removido com sucesso"};
    }
}
    