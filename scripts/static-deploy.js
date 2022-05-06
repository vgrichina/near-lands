const { deploy } = require('ipfs-deploy');
const CID = require('cids');
const { connect, keyStores, Account } = require('near-api-js');

(async () => {
    const cid = await deploy({
        dir: './dist',
        pinningServices: ['infura'],
        logger: {
            info: console.error,
            error: console.error,
            out: console.log
        }
    });
    const cid32 = new CID(cid).toV1().toString('base32');
    const url = `ipfs://${cid32}`;
    console.log('Updating static url', url);

    const config = require('../src/config')(process.env.NODE_ENV);
    const near = await connect({
        ...config,
        keyStore: new keyStores.UnencryptedFileSystemKeyStore(`${process.env.HOME}/.near-credentials`)
    })
    let account = new Account(near.connection, config.contractName);
    const { transaction: { hash } } = await account.functionCall(config.contractName, 'web4_setStaticUrl', { url });
    console.log('Updated in transaction:', `${config.explorerUrl}/transactions/${hash}`);
})().catch(console.error);