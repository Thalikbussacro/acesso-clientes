import * as crypto from 'crypto';
import bcrypt from 'bcrypt';

export interface EncryptedData {
  data: string;
  iv: string;
  authTag: string;
}

export interface KeyDerivationResult {
  key: Buffer;
  salt: Buffer;
}

export class CryptoService {
  // Configurações de criptografia
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16;  // 128 bits
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly PBKDF2_ITERATIONS = 100000; // 100k iterações

  /**
   * Gera um salt criptograficamente seguro
   */
  static generateSalt(): Buffer {
    return crypto.randomBytes(this.SALT_LENGTH);
  }

  /**
   * Deriva uma chave usando PBKDF2
   */
  static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, this.PBKDF2_ITERATIONS, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Gera hash seguro para senhas usando bcrypt
   */
  static async hashPassword(password: string, saltRounds: number = 12): Promise<string> {
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifica senha contra hash bcrypt
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Criptografa dados usando AES-256-GCM
   */
  static encrypt(data: string, key: Buffer): EncryptedData {
    try {
      // Validar tamanho da chave
      if (key.length !== this.KEY_LENGTH) {
        throw new Error(`Chave deve ter ${this.KEY_LENGTH} bytes`);
      }

      // Gerar IV aleatório
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Criar cipher AES-256-GCM usando createCipheriv
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      // Criptografar dados
      let encrypted = cipher.update(data, 'utf8');
      cipher.final();
      
      // Obter tag de autenticação
      const authTag = cipher.getAuthTag();
      
      return {
        data: encrypted.toString('base64'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('❌ Erro na criptografia AES-256-GCM:', error);
      throw new Error('Falha ao criptografar dados');
    }
  }

  /**
   * Descriptografa dados usando AES-256-GCM
   */
  static decrypt(encryptedData: EncryptedData, key: Buffer): string {
    try {
      // Validar tamanho da chave
      if (key.length !== this.KEY_LENGTH) {
        throw new Error(`Chave deve ter ${this.KEY_LENGTH} bytes`);
      }

      // Converter dados de volta para buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const encrypted = Buffer.from(encryptedData.data, 'base64');
      
      // Criar decipher AES-256-GCM usando createDecipheriv
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      // Descriptografar dados
      let decrypted = decipher.update(encrypted);
      decipher.final();
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('❌ Erro na descriptografia AES-256-GCM:', error);
      throw new Error('Falha ao descriptografar dados - chave pode estar incorreta');
    }
  }

  /**
   * Criptografa objeto JSON
   */
  static encryptObject(obj: any, key: Buffer): EncryptedData {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString, key);
  }

  /**
   * Descriptografa para objeto JSON
   */
  static decryptObject<T = any>(encryptedData: EncryptedData, key: Buffer): T {
    const jsonString = this.decrypt(encryptedData, key);
    return JSON.parse(jsonString);
  }

  /**
   * Gera chave mestre a partir da senha do workspace
   */
  static generateMasterKey(password: string, salt?: Buffer): KeyDerivationResult {
    const workspaceSalt = salt || this.generateSalt();
    const masterKey = this.deriveKey(password, workspaceSalt);
    
    return {
      key: masterKey,
      salt: workspaceSalt
    };
  }

  /**
   * Cria hash da chave de criptografia para validação
   */
  static createKeyHash(key: Buffer): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Valida se a chave corresponde ao hash
   */
  static validateKeyHash(key: Buffer, hash: string): boolean {
    const computedHash = this.createKeyHash(key);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }

  /**
   * Gera token JWT seguro
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Cria fingerprint seguro para sessão
   */
  static createSessionFingerprint(userAgent: string, ip: string): string {
    const data = `${userAgent}|${ip}|${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sanitiza dados sensíveis para logs
   */
  static sanitizeForLog(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return '[HIDDEN]';
    }

    const sensitiveFields = [
      'password', 'token', 'key', 'secret', 'auth', 'credential',
      'passwd', 'pwd', 'pass', 'senha', 'chave'
    ];

    const sanitized = { ...data };
    
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[HIDDEN]';
      }
    }

    return sanitized;
  }

  /**
   * Verifica força da senha
   */
  static validatePasswordStrength(password: string): { 
    isValid: boolean; 
    score: number; 
    suggestions: string[] 
  } {
    const suggestions: string[] = [];
    let score = 0;

    // Comprimento mínimo
    if (password.length < 8) {
      suggestions.push('Use pelo menos 8 caracteres');
    } else if (password.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }

    // Letras maiúsculas
    if (!/[A-Z]/.test(password)) {
      suggestions.push('Inclua pelo menos uma letra maiúscula');
    } else {
      score += 1;
    }

    // Letras minúsculas
    if (!/[a-z]/.test(password)) {
      suggestions.push('Inclua pelo menos uma letra minúscula');
    } else {
      score += 1;
    }

    // Números
    if (!/\d/.test(password)) {
      suggestions.push('Inclua pelo menos um número');
    } else {
      score += 1;
    }

    // Caracteres especiais
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      suggestions.push('Inclua pelo menos um caractere especial');
    } else {
      score += 1;
    }

    // Sequências comuns
    if (/123|abc|qwerty|password/i.test(password)) {
      suggestions.push('Evite sequências comuns como "123" ou "abc"');
      score -= 1;
    }

    const isValid = score >= 4 && password.length >= 8;

    return {
      isValid,
      score: Math.max(0, Math.min(5, score)),
      suggestions
    };
  }

  /**
   * Limpa dados sensíveis da memória (best effort)
   */
  static clearSensitiveData(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      buffer.fill(0);
    }
  }
}

export default CryptoService;