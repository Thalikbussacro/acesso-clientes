import express from 'express';
import Client, { CreateClientRequest, UpdateClientRequest } from '../models/Client';
import Workspace from '../models/Workspace';
import AuditService from '../services/AuditService';
import { AuditAction, EntityType } from '../models/AuditLog';

export interface AuthenticatedRequest extends express.Request {
  workspace?: Workspace;
  sessionData?: {
    workspaceId: number;
    sessionId: string;
    fingerprint: string;
    unlocked: boolean;
    lastActivity: number;
    workspace?: Workspace;
  };
}

export class ClientController {
  /**
   * Lista clientes com paginação e busca
   * GET /api/clients
   */
  static async getClients(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { search, page = 1, limit = 50 } = req.query;
      const workspaceId = req.sessionData!.workspaceId;
      const workspace = req.workspace!;

      // Validar parâmetros
      const pageNumber = Math.max(1, parseInt(page as string) || 1);
      const limitNumber = Math.max(1, Math.min(100, parseInt(limit as string) || 50));
      const offset = (pageNumber - 1) * limitNumber;

      // Buscar clientes
      const result = await Client.findAll(workspaceId, workspace, {
        search: search as string,
        limit: limitNumber,
        offset
      });

      // Converter para formato de informações básicas
      const clientsInfo = result.clients.map(client => client.toInfo());

      // Log da ação  
      await AuditService.logEvent(
        { workspace },
        {
          action: AuditAction.CLIENT_VIEWED, // Usar CLIENT_VIEWED já que CLIENT_LIST_VIEWED não existe
          entityType: EntityType.CLIENT,
          details: {
            search: search || null,
            page: pageNumber,
            limit: limitNumber,
            total: result.total
          }
        }
      );

      res.json({
        success: true,
        data: {
          clients: clientsInfo,
          pagination: {
            current_page: pageNumber,
            per_page: limitNumber,
            total: result.total,
            total_pages: Math.ceil(result.total / limitNumber)
          }
        }
      });
    } catch (error) {
      console.error('❌ Erro ao listar clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Cria novo cliente
   * POST /api/clients
   */
  static async createClient(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const workspaceId = req.sessionData!.workspaceId;
      const workspace = req.workspace!;
      
      // Validar dados de entrada
      const { name, notes, images }: CreateClientRequest = req.body;

      if (!name || name.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Nome do cliente é obrigatório'
        });
        return;
      }

      // Verificar se já existe cliente com esse nome
      const existingClients = await Client.findByName(name.trim(), workspaceId, workspace);
      if (existingClients.length > 0) {
        res.status(409).json({
          success: false,
          error: 'Já existe um cliente com este nome'
        });
        return;
      }

      // Criar cliente
      const client = await Client.create(workspaceId, {
        name: name.trim(),
        notes: notes?.trim() || undefined,
        images: images || undefined
      }, workspace);

      // Log da ação
      await AuditService.logEvent(
        { workspace },
        {
          action: AuditAction.CLIENT_CREATED,
          entityType: EntityType.CLIENT,
          entityId: client.id,
          clientId: client.id,
          details: {
            name: client.name,
            hasNotes: client.hasNotes,
            imagesCount: images?.length || 0
          }
        }
      );

      res.status(201).json({
        success: true,
        data: {
          client: client.toInfo()
        }
      });
    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca cliente por ID com detalhes completos
   * GET /api/clients/:id
   */
  static async getClient(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.sessionData!.workspaceId;
      const workspace = req.workspace!;

      // Validar ID
      const clientId = parseInt(id);
      if (isNaN(clientId)) {
        res.status(400).json({
          success: false,
          error: 'ID do cliente inválido'
        });
        return;
      }

      // Buscar cliente
      const client = await Client.findById(clientId, workspace);
      if (!client) {
        res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
        return;
      }

      // Log da ação
      await AuditService.logEvent(
        { workspace },
        {
          action: AuditAction.CLIENT_VIEWED,
          entityType: EntityType.CLIENT,
          entityId: client.id,
          clientId: client.id,
          details: {
            name: client.name
          }
        }
      );

      res.json({
        success: true,
        data: {
          client: client.toDetails()
        }
      });
    } catch (error) {
      console.error('❌ Erro ao buscar cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Atualiza cliente
   * PUT /api/clients/:id
   */
  static async updateClient(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.sessionData!.workspaceId;
      const workspace = req.workspace!;

      // Validar ID
      const clientId = parseInt(id);
      if (isNaN(clientId)) {
        res.status(400).json({
          success: false,
          error: 'ID do cliente inválido'
        });
        return;
      }

      // Buscar cliente
      const client = await Client.findById(clientId, workspace);
      if (!client) {
        res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
        return;
      }

      // Validar dados de entrada
      const { name, notes, images }: UpdateClientRequest = req.body;

      // Se o nome está sendo alterado, verificar duplicatas
      if (name && name.trim() !== client.name) {
        const existingClients = await Client.findByName(name.trim(), workspaceId, workspace);
        const duplicateClient = existingClients.find(c => c.id !== clientId);
        
        if (duplicateClient) {
          res.status(409).json({
            success: false,
            error: 'Já existe um cliente com este nome'
          });
          return;
        }
      }

      // Capturar estado anterior para log
      const previousState = {
        name: client.name,
        hasNotes: client.hasNotes,
        notes: client.getDecryptedNotes(),
        images: client.getDecryptedImages()
      };

      // Atualizar cliente
      await client.update({
        name: name?.trim(),
        notes: notes?.trim(),
        images
      });

      // Log da ação
      await AuditService.logEvent(
        { workspace },
        {
          action: AuditAction.CLIENT_UPDATED,
          entityType: EntityType.CLIENT,
          entityId: client.id,
          clientId: client.id,
          details: {
            previous: previousState,
            updated: {
              name: name?.trim(),
              hasNotes: Boolean(notes?.trim()),
              imagesCount: images?.length || 0
            }
          }
        }
      );

      res.json({
        success: true,
        data: {
          client: client.toInfo()
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Deleta cliente
   * DELETE /api/clients/:id
   */
  static async deleteClient(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.sessionData!.workspaceId;
      const workspace = req.workspace!;

      // Validar ID
      const clientId = parseInt(id);
      if (isNaN(clientId)) {
        res.status(400).json({
          success: false,
          error: 'ID do cliente inválido'
        });
        return;
      }

      // Buscar cliente
      const client = await Client.findById(clientId, workspace);
      if (!client) {
        res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
        return;
      }

      // Capturar informações para log
      const clientInfo = {
        id: client.id,
        name: client.name,
        hasNotes: client.hasNotes,
        imagesCount: client.getDecryptedImages().length
      };

      // Deletar cliente
      await client.delete();

      // Log da ação
      await AuditService.logEvent(
        { workspace },
        {
          action: AuditAction.CLIENT_DELETED,
          entityType: EntityType.CLIENT,
          entityId: clientInfo.id,
          clientId: clientInfo.id,
          details: clientInfo
        }
      );

      res.json({
        success: true,
        message: 'Cliente deletado com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao deletar cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Conta total de clientes
   * GET /api/clients/count
   */
  static async getClientsCount(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const workspaceId = req.sessionData!.workspaceId;
      const count = await Client.count(workspaceId);

      res.json({
        success: true,
        data: {
          count
        }
      });
    } catch (error) {
      console.error('❌ Erro ao contar clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

export default ClientController;