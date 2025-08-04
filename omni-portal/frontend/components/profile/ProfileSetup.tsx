import React from 'react';

interface ProfileSetupProps {}

const ProfileSetup: React.FC<ProfileSetupProps> = () => {
  return (
    <div>
      <h2>Configuração do Perfil</h2>
      <form>
        <label htmlFor="birthDate">Data de Nascimento</label>
        <input id="birthDate" type="date" />
        
        <label htmlFor="address">Endereço</label>
        <input id="address" type="text" />
        
        <label htmlFor="city">Cidade</label>
        <input id="city" type="text" />
        
        <label htmlFor="state">Estado</label>
        <select id="state">
          <option value="">Selecione o Estado</option>
          <option value="SP">SP</option>
        </select>
        
        <button type="submit">Salvar Perfil</button>
      </form>
      <div>Perfil completado com sucesso!</div>
    </div>
  );
};

export default ProfileSetup;