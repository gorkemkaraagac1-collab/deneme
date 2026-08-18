const TFRS16_STORAGE_KEY =
  "gk_tfrs16_contracts";


function saveContract(contract) {

  const existing =
    JSON.parse(
      localStorage.getItem(
        TFRS16_STORAGE_KEY
      ) || "[]"
    );


  existing.push(contract);


  localStorage.setItem(
    TFRS16_STORAGE_KEY,
    JSON.stringify(existing)
  );


  console.log(
    "TFRS 16 sözleşmesi kaydedildi:",
    contract.id
  );

}


function getAllContracts() {

  return JSON.parse(
    localStorage.getItem(
      TFRS16_STORAGE_KEY
    ) || "[]"
  );

}


function deleteContract(contractId) {

  const contracts =
    getAllContracts();


  const updated =
    contracts.filter(
      c => c.id !== contractId
    );


  localStorage.setItem(
    TFRS16_STORAGE_KEY,
    JSON.stringify(updated)
  );

}


function updateContract(
  contractId,
  changes
) {

  const contracts =
    getAllContracts();


  const updated =
    contracts.map(contract => {

      if (
        contract.id !== contractId
      ) {
        return contract;
      }


      return {
        ...contract,
        ...changes
      };

    });


  localStorage.setItem(
    TFRS16_STORAGE_KEY,
    JSON.stringify(updated)
  );

}
