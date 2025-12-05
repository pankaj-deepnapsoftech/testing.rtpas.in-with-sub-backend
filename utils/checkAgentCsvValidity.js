exports.checkAgentCsvValidity = async (data) => {
    for (let i = 0; i < data.length; i++) {
      const agent = data[i];
      if (!agent.agent_type) {
        throw new Error(`Agent type is a required field in row: ${i + 1}`);
      }
      if (!agent.name) {
        throw new Error(`Name is a required field in row: ${i + 1}`);
      }
      if (!agent.email) {
        throw new Error(`Email is a required field in row: ${i + 1}`);
      }
      if (!agent.phone) {
        throw new Error(`Phone is a required field in row: ${i + 1}`);
      }
      if (!agent.company_name) {
        throw new Error(`Company name is a required field in row: ${i + 1}`);
      }
      if (!agent.company_email) {
        throw new Error(`Company email is a required field in row: ${i + 1}`);
      }
      if (!agent.company_phone) {
        throw new Error(`Company phone is a required field in row: ${i + 1}`);
      }
      if (!agent.address_line1) {
        throw new Error(`Address line 1 is a required field in row: ${i + 1}`);
      }
      if (!agent.city) {
        throw new Error(`City is a required field in row: ${i + 1}`);
      }
      if (!agent.state) {
        throw new Error(`State is a required field in row: ${i + 1}`);
      }
    }
  };
  