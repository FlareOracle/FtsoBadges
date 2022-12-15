
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { expect } from 'chai'
import { ethers } from "hardhat"
import { FtsoBadges, FtsoBadges__factory, IVoterWhitelister } from '../typechain-types';
import { IFtsoRegistry } from '../typechain-types/contracts/FtsoPledges.sol';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

const pledge = `As a price provider of the FTSO protocol, I hereby commit to only contributing to one price provider and to not sharing fundamental code or algorithms with other price providers. By signing this text, I pledge to uphold Songbird decentralized nature. I understand that if I violate this commitment, I may lose my badge and my reputation as a trustworthy price provider may be compromised. I am committed to acting in good faith and contributing to the success of the FTSO protocol.`

const stablecoinPledge = `As a price provider of the FTSO protocol, I hereby pledge to monitor the rates of any stablecoins that I use in order to notice depeg events and take necessary steps to keep my submitted prices in USD.
By signing this pledge, I acknowledge that I understand the importance of maintaining the accuracy and integrity of the prices on the FTSO protocol, and the potential consequences of breaking my commitments. If I were to violate these commitments, I understand that my badge as a trusted price provider could be revoked.
Maintaining the accuracy and integrity of the prices on the FTSO protocol is crucial for the success of the protocol and the protection of all participants. Depeg events can potentially cause significant deviations from USD, which can lead to losses for participants and undermine the trust and confidence in the protocol. It is therefore important that all price providers take their commitments to monitoring depeg events seriously and take appropriate action to keep their submitted prices aligned with the value of USD.`


describe('FtsoBadges', () => {
    let whitelister: FakeContract<IVoterWhitelister>
    let registry: FakeContract<IFtsoRegistry>
    let badges: MockContract<FtsoBadges>

    async function claim(signer: SignerWithAddress, id: number, pledge: string) {
        const signature = await signer.signMessage(pledge)
        return badges.connect(signer).claimBadge(id, signature)
    }

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        whitelister = await smock.fake('IVoterWhitelister')
        registry = await smock.fake('IFtsoRegistry')
        whitelister.getFtsoWhitelistedPriceProviders.returns(
            accounts
                .slice(0, 10)
                .map(x => x.address)
        )
        registry.getSupportedIndicesAndFtsos.returns([[0], [ethers.constants.AddressZero]])
        const Badges = await smock.mock<FtsoBadges__factory>('FtsoBadges');
        badges = await Badges.deploy(registry.address, whitelister.address);
        await badges.add('', pledge)
        await badges.add('', stablecoinPledge)
    });

    it('claims badges', async () => {
        const accounts = await ethers.getSigners()
        const p = accounts[0]

        await expect(claim(p, 0, pledge))
            .to.emit(badges, 'Pledged')
            .withArgs(0, p.address)

        await expect(claim(p, 1, stablecoinPledge))
            .to.emit(badges, 'Pledged')
            .withArgs(1, p.address)

        expect(await badges.balanceOf(p.address, 0)).to.eq(1)
        expect(await badges.balanceOf(p.address, 1)).to.eq(1)
    })

    it('returns accounts with badges', async () => {
        const accounts = await ethers.getSigners()
        const p = accounts[0]
        const p1 = accounts[1]
        const p2 = accounts[2]

        await claim(p, 0, pledge)
        await claim(p1, 0, pledge)
        await claim(p, 1, stablecoinPledge)
        await claim(p2, 1, stablecoinPledge)

        const accounts0 = new Set(await badges.getAccountsWithBadges(0))
        const accounts1 = new Set(await badges.getAccountsWithBadges(1))

        expect(accounts0.has(p.address)).to.be.true
        expect(accounts0.has(p1.address)).to.be.true
        expect(accounts1.has(p.address)).to.be.true
        expect(accounts1.has(p2.address)).to.be.true

        expect(accounts0.has(p2.address)).to.be.false
        expect(accounts1.has(p1.address)).to.be.false
    })

    it('fails to claim with invalid signature', async () => {
        const accounts = await ethers.getSigners()
        const p = accounts[0]
        const p1 = accounts[1]

        await expect(claim(p, 0, pledge.substring(0, pledge.length - 1)))
            .to.be.revertedWith('Not a valid signature')

        const signatureWrongWallet = await p1.signMessage(pledge)
        await expect(badges.claimBadge(1, signatureWrongWallet))
            .to.be.revertedWith('Not a valid signature')
    })

    it('revokes and redeems', async () => {
        const accounts = await ethers.getSigners()
        const p = accounts[0]
        const p1 = accounts[1]
        const p2 = accounts[2]

        await claim(p, 0, pledge)
        await claim(p1, 0, pledge)
        await claim(p, 1, stablecoinPledge)
        await claim(p2, 1, stablecoinPledge)

        await expect(badges.revoke(p1.address, 0))
            .to.emit(badges, 'Revoked')
            .withArgs(0, p1.address)

        await expect(badges.revoke(p.address, 1))
            .to.emit(badges, 'Revoked')
            .withArgs(1, p.address)

        expect(await badges.balanceOf(p1.address, 0)).to.eq(0)
        expect(await badges.balanceOf(p.address, 1)).to.eq(0)

        await expect(claim(p1, 0, pledge))
            .to.be.revertedWith('Revoked')
        await expect(claim(p, 1, stablecoinPledge))
            .to.be.revertedWith('Revoked')

        const accounts0 = new Set(await badges.getAccountsWithBadges(0))
        const accounts1 = new Set(await badges.getAccountsWithBadges(1))

        expect(accounts0.has(p.address)).to.be.true
        expect(accounts1.has(p2.address)).to.be.true

        expect(accounts0.has(p1.address)).to.be.false
        expect(accounts1.has(p.address)).to.be.false

        await expect(badges.redeem(p1.address, 0))
            .to.emit(badges, 'Redeemed')
            .withArgs(0, p1.address)
        await badges.redeem(p.address, 1)

        await claim(p1, 0, pledge)
        await claim(p, 1, stablecoinPledge)
    })

    it('reverts when claimed by non-whitelisted account', async () => {
        const accounts = await ethers.getSigners()
        const p = accounts[10]
        await expect(claim(p, 0, pledge))
            .to.be.revertedWith('Not whitelisted to FTSO')
    })
});