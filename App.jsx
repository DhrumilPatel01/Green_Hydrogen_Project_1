import React, { useState, useEffect } from 'react';
import { ethers } from "ethers";
import { getContract, SubsidyAgreementABI } from "./utils/contract";
// import Box from '3box'; // Removed 3box import due to deprecation and build issues
import './App.css'

// Backend API configuration
const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [owner, setOwner] = useState(null);
  const [producer, setProducer] = useState(null);
  const [oracle, setOracle] = useState(null);
  const [totalSubsidy, setTotalSubsidy] = useState(0);
  const [disbursedAmount, setDisbursedAmount] = useState(0);
  const [milestones, setMilestones] = useState([]);
  const [newOracleAddress, setNewOracleAddress] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [newProgressValue, setNewProgressValue] = useState("");
  const [events, setEvents] = useState([]);
  const [isSettingOracle, setIsSettingOracle] = useState(false);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [isTriggeringDisbursement, setIsTriggeringDisbursement] = useState(false);
  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);
  // const [userProfile, setUserProfile] = useState(null); // Removed 3Box profile state
  // const [threeBox, setThreeBox] = useState(null); // Removed 3Box instance state

  // Database state variables
  const [dbMilestones, setDbMilestones] = useState([]);
  const [dbEvents, setDbEvents] = useState([]);
  const [dbProjects, setDbProjects] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    // Close disconnect menu if clicked outside
    const handleClickOutside = (event) => {
      if (event.target.closest('.wallet-section') === null) {
        setShowDisconnectMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0]);
        if (contract) {
          loadContractData(contract);
        }
      });

      // Event listeners - only set up if contract is deployed
      if (contract && owner !== "0x0000000000000000000000000000000000000000") {
        try {
          const filterOracleUpdate = contract.filters.OracleAddressUpdated();
          const filterMilestoneProgress = contract.filters.MilestoneProgressUpdated();
          const filterSubsidyDisbursed = contract.filters.SubsidyDisbursed();

          contract.on(filterOracleUpdate, (newOracle, event) => {
            console.log("OracleAddressUpdated event:", newOracle, event);
            setEvents((prev) => [...prev, { type: "OracleAddressUpdated", data: { newOracle }, timestamp: new Date().toLocaleString() }]);
            loadContractData(contract); // Reload data after event
          });

          contract.on(filterMilestoneProgress, (milestoneId, newProgress, event) => {
            console.log("MilestoneProgressUpdated event:", milestoneId, newProgress, event);
            setEvents((prev) => [...prev, { type: "MilestoneProgressUpdated", data: { milestoneId: Number(milestoneId), newProgress: Number(newProgress) }, timestamp: new Date().toLocaleString() }]);
            loadContractData(contract); // Reload data after event
          });

          contract.on(filterSubsidyDisbursed, (to, amount, milestoneId, event) => {
            console.log("SubsidyDisbursed event:", to, amount, milestoneId, event);
            setEvents((prev) => [...prev, { type: "SubsidyDisbursed", data: { to, amount: ethers.formatUnits(amount, 6), milestoneId: Number(milestoneId) }, timestamp: new Date().toLocaleString() }]);
            loadContractData(contract); // Reload data after event
          });

          return () => {
            contract.off(filterOracleUpdate);
            contract.off(filterMilestoneProgress);
            contract.off(filterSubsidyDisbursed);
          };
        } catch (error) {
          console.log("Contract not deployed yet, skipping event listeners setup");
        }
      }
    }
  }, [contract, owner]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        console.log("Connecting to MetaMask...");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        console.log("Connected wallet address:", address);
        setAccount(address);

        console.log("Getting contract instance...");
        const subsidyContract = getContract(signer);
        console.log("Contract instance created:", subsidyContract);
        setContract(subsidyContract);
        
        console.log("Loading contract data...");
        await loadContractData(subsidyContract);
        setShowDisconnectMenu(false); // Close menu on successful connection

        console.log("Wallet connection successful!");

      } catch (error) {
        console.error("Error connecting to MetaMask:", error);
        alert(`Failed to connect wallet: ${error.message}`);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const handleDisconnect = async () => {
    // if (threeBox) {
    //   await threeBox.logout();
    // }
    setAccount(null);
    setContract(null);
    setOwner(null);
    setProducer(null);
    setOracle(null);
    setTotalSubsidy(0);
    setDisbursedAmount(0);
    setMilestones([]);
    setEvents([]);
    setShowDisconnectMenu(false); // Close menu on disconnect
    // setUserProfile(null); // Clear 3Box profile
    // setThreeBox(null); // Clear 3Box instance
  };

  const handleViewOnExplorer = () => {
    if (account) {
      // Reverting to mumbai.polygonscan.com as it's the official one, hoping it's accessible now.
      window.open(`https://mumbai.polygonscan.com/address/${account}`, '_blank');
      setShowDisconnectMenu(false); // Close menu after opening explorer
    }
  };

  const loadContractData = async (subsidyContract) => {
    try {
      // Check if contract address is valid (not placeholder)
      const contractAddress = await subsidyContract.getAddress();
      if (contractAddress === "0x0000000000000000000000000000000000000000") {
        console.log("Contract not deployed yet. Using placeholder data for demonstration.");
        // Set placeholder data for demonstration
        setOwner("0x0000000000000000000000000000000000000000");
        setProducer("0x0000000000000000000000000000000000000000");
        setOracle("0x0000000000000000000000000000000000000000");
        setTotalSubsidy("0");
        setDisbursedAmount("0");
        setMilestones([]);
        setEvents([]);
        return;
      }

      const contractOwner = await subsidyContract.owner();
      setOwner(contractOwner);

      const hydrogenProducer = await subsidyContract.hydrogenProducer();
      setProducer(hydrogenProducer);

      const oracleAddress = await subsidyContract.oracleAddress();
      setOracle(oracleAddress);

      const total = await subsidyContract.totalSubsidyAmount();
      setTotalSubsidy(ethers.formatUnits(total, 6));

      const disbursed = await subsidyContract.amountDisbursed();
      setDisbursedAmount(ethers.formatUnits(disbursed, 6));

      const milestonesCount = (await subsidyContract.milestones.length);
      const fetchedMilestones = [];
      for (let i = 0; i < milestonesCount; i++) {
        const milestone = await subsidyContract.milestones(i);
        fetchedMilestones.push({
          id: i,
          description: milestone.description,
          targetValue: Number(milestone.targetValue),
          achievedValue: Number(milestone.achievedValue),
          payoutAmount: ethers.formatUnits(milestone.payoutAmount, 6),
          isCompleted: milestone.isCompleted,
        });
      }
      setMilestones(fetchedMilestones);

    } catch (error) {
      console.error("Error loading contract data:", error);
      // Set default values on error
      setOwner("0x0000000000000000000000000000000000000000");
      setProducer("0x0000000000000000000000000000000000000000");
      setOracle("0x0000000000000000000000000000000000000000");
      setTotalSubsidy("0");
      setDisbursedAmount("0");
      setMilestones([]);
      setEvents([]);
    }
  };

  // Database API functions
  const fetchDatabaseData = async () => {
    if (!account) return;
    
    setIsLoadingDb(true);
    setDbError(null);
    
    try {
      // Fetch all data in parallel
      const [milestonesRes, eventsRes, projectsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/events?userAddress=${account}`),
        fetch(`${API_BASE_URL}/events`),
        fetch(`${API_BASE_URL}/projects`),
        fetch(`${API_BASE_URL}/users`)
      ]);

      if (milestonesRes.ok) {
        const milestonesData = await milestonesRes.json();
        setDbMilestones(milestonesData);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setDbEvents(eventsData);
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setDbProjects(projectsData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setDbUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching database data:', error);
      setDbError('Failed to fetch data from database');
    } finally {
      setIsLoadingDb(false);
    }
  };

  const syncBlockchainToDatabase = async (eventType, eventData) => {
    if (!account || !contract) return;
    
    try {
      const eventLog = {
        eventId: `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: eventType,
        contractAddress: contract.address,
        userAddress: account,
        data: eventData,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventLog)
      });

      if (response.ok) {
        console.log('Event synced to database:', eventType);
        // Refresh database data
        fetchDatabaseData();
      }
    } catch (error) {
      console.error('Error syncing to database:', error);
    }
  };

  const createOrUpdateUserProfile = async () => {
    if (!account) return;
    
    try {
      // Check if user exists
      const existingUser = dbUsers.find(user => user.walletAddress === account.toLowerCase());
      
      if (!existingUser) {
        // Create new user profile
        const newUser = {
          walletAddress: account,
          username: `User_${account.substring(0, 6)}`,
          role: account === owner ? 'owner' : account === producer ? 'producer' : 'oracle',
          profile: {
            name: `User ${account.substring(0, 6)}...${account.substring(38)}`,
            organization: 'Green Hydrogen DApp User',
            location: 'India'
          }
        };

        const response = await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newUser)
        });

        if (response.ok) {
          console.log('User profile created in database');
          fetchDatabaseData();
        }
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  // Enhanced useEffect to include database integration
  useEffect(() => {
    if (account && contract) {
      loadContractData(contract);
      fetchDatabaseData();
      createOrUpdateUserProfile();
    }
  }, [account, contract]);

  const handleSetOracleAddress = async () => {
    if (!contract || !account || !newOracleAddress) {
      alert("Please connect your wallet and enter an oracle address.");
      return;
    }
    if (account !== owner) {
      alert("Only the owner can set the oracle address.");
      return;
    }
    setIsSettingOracle(true);
    try {
      const tx = await contract.setOracleAddress(newOracleAddress);
      await tx.wait();
      alert("Oracle address set successfully!");
      setNewOracleAddress("");
      
      // Sync to database
      await syncBlockchainToDatabase('OracleAddressUpdated', {
        newOracleAddress: newOracleAddress,
        previousOracle: oracle
      });
      
      fetchContractData();
    } catch (error) {
      console.error("Error setting oracle address:", error);
      alert("Failed to set oracle address.");
    } finally {
      setIsSettingOracle(false);
      setShowDisconnectMenu(false);
    }
  };

  const handleUpdateMilestoneProgress = async () => {
    if (!contract || !account) {
      alert("Please connect your wallet.");
      return;
    }
    if (account !== oracle) {
      alert("Only the oracle can update milestone progress.");
      return;
    }
    if (selectedMilestoneId === "" || newProgressValue === "") {
      alert("Please select a milestone and enter a new progress value.");
      return;
    }
    setIsUpdatingProgress(true);
    try {
      const tx = await contract.updateMilestoneProgress(selectedMilestoneId, newProgressValue);
      await tx.wait();
      alert(`Milestone ${Number(selectedMilestoneId) + 1} progress updated successfully!`);
      
      // Sync to database
      await syncBlockchainToDatabase('MilestoneProgressUpdated', {
        milestoneId: selectedMilestoneId,
        newProgress: newProgressValue,
        previousProgress: milestones[selectedMilestoneId]?.achievedValue
      });
      
      setSelectedMilestoneId("");
      setNewProgressValue("");
      fetchContractData();
    } catch (error) {
      console.error("Error updating milestone progress:", error);
      alert("Failed to update milestone progress.");
    } finally {
      setIsUpdatingProgress(false);
      setShowDisconnectMenu(false);
    }
  };

  const handleTriggerDisbursement = async (milestoneId) => {
    if (!contract || !account) {
      alert("Please connect your wallet.");
      return;
    }
    setIsTriggeringDisbursement(true);
    try {
      const tx = await contract.triggerDisbursement(milestoneId);
      await tx.wait();
      alert(`Disbursement for Milestone ${milestoneId + 1} triggered successfully!`);
      
      // Sync to database
      await syncBlockchainToDatabase('SubsidyDisbursed', {
        milestoneId: milestoneId,
        amount: milestones[milestoneId]?.payoutAmount,
        recipient: producer
      });
      
      fetchContractData();
    } catch (error) {
      console.error("Error triggering disbursement:", error);
      alert("Failed to trigger disbursement. Check if milestone is met and not yet disbursed.");
    } finally {
      setIsTriggeringDisbursement(false);
      setShowDisconnectMenu(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-section">
          <h1>Green Hydrogen Subsidy DApp</h1>
      </div>
        <nav className="main-nav">
          <a href="#home">Home</a>
          <a href="#news-events">News & Events</a>
          <a href="#impact">Impact</a>
          <a href="#stories">Stories</a>
          <a href="#research-analysis">Research & Analysis</a>
          <a href="#about">About Green Hydrogen</a>
          {account && <a href="#contract-info">DApp Dashboard</a>}
        </nav>
        <div className="wallet-section">
          <button onClick={account ? () => setShowDisconnectMenu(!showDisconnectMenu) : connectWallet}>
            {account ? `Connected: ${account.substring(0, 6)}...${account.substring(38)}` : 'Connect Wallet'}
        </button>
          {account && showDisconnectMenu && (
            <div className="disconnect-menu">
              {/* <button onClick={handleViewOnExplorer}>View on Explorer</button> */}
              <button onClick={handleDisconnect}>Disconnect</button>
            </div>
          )}
        </div>
      </header>

      <main className="App-main">
        <section id="home" className="hero-section card-section">
          <h2>Welcome to the Green Hydrogen Subsidy DApp</h2>
          <p>Automating sustainable energy incentives with blockchain transparency.</p>
          {!account && (
            <p className="connect-wallet-message connect-button-style" onClick={connectWallet}>Connect your MetaMask wallet to get started.</p>
          )}
        </section>

        <section id="news-events" className="news-events-section card-section">
          <h2>News & Events</h2>
          <div className="news-grid">
            <div className="news-item">
              <h3>India's Green Hydrogen Mission Accelerates</h3>
              <p>Recent policy changes and government incentives are boosting green hydrogen production across key states. Read more about the progress and opportunities.</p>
              <a href="https://www.gh2.org.in/news" target="_blank" rel="noopener noreferrer">Read Article</a>
            </div>
            <div className="news-item">
              <h3>Upcoming Webinar: Future of Green Hydrogen</h3>
              <p>Join experts on [Date] to discuss the technological advancements and market dynamics shaping the green hydrogen sector. Register now!</p>
              <a href="https://www.gh2.org.in/events" target="_blank" rel="noopener noreferrer">View Event</a>
            </div>
            <div className="news-item">
              <h3>New Report: Techno-Economic Feasibility in India</h3>
              <p>Our latest research highlights the cost economics and development considerations for green hydrogen projects in India. Download the full report.</p>
              <a href="https://www.gh2.org.in/resources" target="_blank" rel="noopener noreferrer">Download Report</a>
            </div>
          </div>
        </section>

        <section id="impact" className="impact-section card-section">
          <h2>Impact</h2>
          <div className="impact-content">
            <div className="impact-stats">
              <div className="stat-item">
                <h3>Carbon Reduction</h3>
                <p>Green hydrogen can reduce CO₂ emissions by up to 830 million tons annually by 2050</p>
              </div>
              <div className="stat-item">
                <h3>Energy Security</h3>
                <p>Reduces dependence on fossil fuel imports and enhances national energy independence</p>
              </div>
              <div className="stat-item">
                <h3>Economic Growth</h3>
                <p>Creates new jobs in renewable energy, manufacturing, and infrastructure sectors</p>
              </div>
            </div>
            
            <div className="india-potential">
              <h3>India's Green Hydrogen Potential</h3>
              <div className="potential-map-container">
                <img 
                  src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500&h=300&fit=crop&crop=center" 
                  alt="India's Green Hydrogen Policy Map"
                  className="potential-map"
                />
              </div>
              <div className="potential-description">
                <p>
                  India has ambitious plans to become a global leader in green hydrogen production. 
                  Seven states - Odisha, Maharashtra, Tamil Nadu, Uttar Pradesh, Rajasthan, Gujarat, 
                  and Andhra Pradesh - account for 92% of the potential support, with policies already 
                  notified in most states.
                </p>
                <p>
                  The government has allocated significant funding for green hydrogen projects, with 
                  Odisha leading in power sector support (₹1,15,364 crore) and Tamil Nadu leading in 
                  non-power sector support (₹62,347 crore). This comprehensive policy framework positions 
                  India as a key player in the global green hydrogen economy.
                </p>
              </div>
            </div>
            
            <div className="impact-grid">
              <div className="impact-item">
                <h3>Faster, More Transparent Distribution</h3>
                <p>Our DApp ensures public funds are distributed quickly and openly, minimizing delays and increasing trust.</p>
              </div>
              <div className="impact-item">
                <h3>Reduces Risk of Fraud and Misappropriation</h3>
                <p>By automating verification and recording all transactions on the blockchain, the system significantly lowers fraud risks.</p>
              </div>
              <div className="impact-item">
                <h3>Increases Green Hydrogen Project Uptake</h3>
                <p>Predictable and reliable subsidy support encourages more investment and development in green hydrogen initiatives.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="stories" className="stories-section card-section">
          <h2>Stories</h2>
          <div className="stories-grid">
            <div className="story-item">
              <h3>Empowering Local Producers</h3>
              <p>Meet [Producer Name], a local entrepreneur who scaled green hydrogen production thanks to predictable subsidies from our DApp.</p>
              <a href="https://www.sciencedirect.com/science/article/pii/S2590123025011843" target="_blank" rel="noopener noreferrer">Read Story</a>
            </div>
            <div className="story-item">
              <h3>Transforming Communities with Clean Energy</h3>
              <p>Discover how green hydrogen projects supported by the DApp are bringing sustainable development to remote areas.</p>
              <a href="https://rmi.org/stories/" target="_blank" rel="noopener noreferrer">Read Story</a>
            </div>
          </div>
        </section>

        <section id="research-analysis" className="research-analysis-section card-section">
          <h2>Research & Analysis</h2>
          <div className="research-grid">
            <div className="research-item">
              <h3>Techno-Economic Feasibility of Green Hydrogen Projects in India</h3>
              <p>A detailed study unpacking cost economics, key project development considerations, and risks in India’s evolving green hydrogen landscape.</p>
              <a href="https://rmi.org/research" target="_blank" rel="noopener noreferrer">Read Report</a>
            </div>
            <div className="research-item">
              <h3>State Policy Waivers and Incentives Impact</h3>
              <p>Analysis on how sub-national policies can reduce renewable power costs for green hydrogen projects by over 90%.</p>
              <a href="https://rmi.org/research" target="_blank" rel="noopener noreferrer">View Analysis</a>
            </div>
          </div>
        </section>

        {/* About Green Hydrogen Section */}
        <section id="about" className="about-section card-section">
          <h2>About Green Hydrogen</h2>
          <div className="about-content">
            <div className="about-text">
              <p>
                Green hydrogen is produced by splitting water (H₂O) into hydrogen (H₂) and oxygen (O₂) 
                using renewable energy sources through a process called electrolysis. Unlike traditional 
                hydrogen production methods that rely on fossil fuels, green hydrogen is completely 
                sustainable and produces zero carbon emissions.
              </p>
              <p>
                This clean energy carrier has the potential to revolutionize industries like transportation, 
                manufacturing, and power generation, helping us achieve net-zero carbon emissions and 
                combat climate change.
              </p>
            </div>
            
            <div className="energy-sources-grid">
              <div className="energy-source-card">
                <h3>Renewable Energy Sources</h3>
                <div className="energy-image-container">
                  <img 
                    src="https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&h=300&fit=crop&crop=center" 
                    alt="Renewable Energy Sources Infographic"
                    className="energy-image"
                  />
                </div>
                <p className="energy-description">
                  Green hydrogen production relies on clean, renewable energy sources including solar power, 
                  wind energy, hydroelectric power, geothermal energy, biomass energy, and tidal energy. 
                  These sustainable sources ensure that the entire hydrogen production process is environmentally 
                  friendly and carbon-neutral.
        </p>
      </div>
              
              <div className="energy-source-card">
                <h3>Green Hydrogen Production Process</h3>
                <div className="energy-image-container">
                  <img 
                    src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&crop=center" 
                    alt="Green Hydrogen Production Process"
                    className="energy-image"
                  />
                </div>
                <p className="energy-description">
                  The production process begins with renewable energy generation (solar panels, wind turbines), 
                  which powers electrolyzers to split water molecules. The resulting hydrogen is stored in 
                  specialized tanks and can be used as a clean fuel for vehicles, industrial processes, and 
                  power generation, with water as the only byproduct.
                </p>
              </div>
            </div>
          </div>
        </section>

        {account && contract ? (
          <>
            <section id="contract-info" className="contract-info card-section">
              <h2>Contract Information</h2>
              <p><strong>Your Connected Wallet:</strong> {account}</p>
              
              {/* Contract Deployment Status */}
              {owner === "0x0000000000000000000000000000000000000000" && (
                <div className="contract-not-deployed">
                  <h3>⚠️ Contract Not Deployed Yet</h3>
                  <p>This is a demonstration mode. The smart contract has not been deployed to the blockchain yet.</p>
                  <p>To deploy the contract:</p>
                  <ol>
                    <li>Navigate to the <code>blockchain</code> directory</li>
                    <li>Run <code>npx hardhat run scripts/deploy.js --network mumbai</code></li>
                    <li>Update the contract address in <code>client/src/utils/contract.ts</code></li>
                  </ol>
                  <p><strong>Current Status:</strong> Using placeholder data for demonstration</p>
                </div>
              )}
              
              {/* Blockchain Contract Data (when deployed) */}
              {owner !== "0x0000000000000000000000000000000000000000" && (
                <>
                  {account === owner && <p className="user-role-tag owner-tag">You are the Owner!</p>}
                  {account === producer && <p className="user-role-tag producer-tag">You are the Producer!</p>}
                  {account === oracle && <p className="user-role-tag oracle-tag">You are the Oracle!</p>}
                  <p><strong>Owner:</strong> {owner}</p>
                  <p><strong>Producer:</strong> {producer}</p>
                  <p><strong>Oracle:</strong> {oracle || "Not set"}</p>
                </>
              )}
              
              {/* Database User Profile */}
              {dbUsers.length > 0 && (
                <div className="user-profile-db">
                  <h4>🌟 Your User Profile (Database)</h4>
                  {dbUsers.map(user => (
                    user.walletAddress === account.toLowerCase() && (
                      <div key={user._id} className="user-profile-card">
                        <div className="profile-header">
                          <h5>👤 {user.username}</h5>
                          <span className={`role-badge ${user.role}`}>{user.role.toUpperCase()}</span>
                        </div>
                        {user.profile && (
                          <div className="profile-details">
                            <p><strong>🏢 Organization:</strong> {user.profile.organization}</p>
                            <p><strong>📍 Location:</strong> {user.profile.location}</p>
                            <p><strong>📝 Bio:</strong> {user.profile.bio}</p>
                            {user.profile.avatar && (
                              <div className="profile-avatar">
                                <img src={user.profile.avatar} alt="Profile Avatar" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}
              
              {account === owner && milestones.length > 0 && (
                <div className="dapp-stats">
                  <h4>Overall DApp Statistics</h4>
                  <p>Total Milestones: {milestones.length}</p>
                  <p>Completed Milestones: {milestones.filter(m => m.isCompleted).length}</p>
                  <p>Pending Milestones: {milestones.filter(m => !m.isCompleted).length}</p>
                </div>
              )}
              
              <p><strong>Total Subsidy:</strong> {totalSubsidy} USDC</p>
              <p><strong>Disbursed Amount:</strong> {disbursedAmount} USDC</p>
              
              {/* Database Status */}
              <div className="db-status">
                <h4>Database Status</h4>
                {isLoadingDb ? (
                  <p>🔄 Loading database data...</p>
                ) : dbError ? (
                  <p>❌ {dbError}</p>
                ) : dbUsers.length > 0 ? (
                  <p>✅ Database connected - {dbUsers.length} users found</p>
                ) : (
                  <p>⚠️ No database data available</p>
                )}
              </div>
              
              {/* User's Projects from Database */}
              {dbProjects.length > 0 && (
                <div className="user-projects-db">
                  <h4>🏗️ Your Projects (Database)</h4>
                  <div className="user-projects-grid">
                    {dbProjects
                      .filter(project => project.owner === account)
                      .map(project => (
                        <div key={project._id} className="user-project-card">
                          <div className="project-title">
                            <h5>{project.name}</h5>
                            <span className={`project-status ${project.status}`}>
                              {project.status}
                            </span>
                          </div>
                          <p className="project-desc">{project.description}</p>
                          <div className="project-stats">
                            <p><strong>ID:</strong> {project.projectId}</p>
                            <p><strong>Subsidy:</strong> ₹{(project.totalSubsidy / 100000).toFixed(2)} Lakhs</p>
                            <p><strong>Disbursed:</strong> ₹{(project.disbursedAmount / 100000).toFixed(2)} Lakhs</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Database Connection Status */}
              <div className="db-status">
                <h4>Database Status</h4>
                {isLoadingDb ? (
                  <p className="loading">🔄 Loading database data...</p>
                ) : dbError ? (
                  <p className="error">❌ {dbError}</p>
                ) : (
                  <p className="success">✅ Database connected and synced</p>
                )}
              </div>
            </section>

            {account === owner && owner !== "0x0000000000000000000000000000000000000000" && (
              <section className="admin-section card-section">
                <h3>Admin Actions (Owner)</h3>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="New Oracle Address"
                    value={newOracleAddress}
                    onChange={(e) => setNewOracleAddress(e.target.value)}
                    disabled={isSettingOracle}
                  />
                  <button onClick={handleSetOracleAddress} disabled={isSettingOracle}>
                    {isSettingOracle ? 'Setting...' : 'Set Oracle'}
                  </button>
                </div>
              </section>
            )}

            {account === oracle && oracle !== "0x0000000000000000000000000000000000000000" && (
              <section className="oracle-section card-section">
                <h3>Oracle Actions</h3>
                <div className="input-group">
                  <select
                    value={selectedMilestoneId}
                    onChange={(e) => setSelectedMilestoneId(e.target.value)}
                    disabled={isUpdatingProgress}
                  >
                    <option value="">Select Milestone</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>Milestone {m.id + 1}: {m.description}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="New Progress Value"
                    value={newProgressValue}
                    onChange={(e) => setNewProgressValue(e.target.value)}
                    disabled={isUpdatingProgress}
                  />
                  <button onClick={handleUpdateMilestoneProgress} disabled={isUpdatingProgress}>
                    {isUpdatingProgress ? 'Updating...' : 'Update Progress'}
                  </button>
                </div>
              </section>
            )}

            <section id="milestones" className="milestones-list card-section">
              <h2>Milestones</h2>
              
              {/* Blockchain Milestones */}
              <div className="milestones-section">
                <h3>Blockchain Milestones</h3>
                <div className="milestones-grid">
                  {milestones.length === 0 ? (
                    <p>No milestones defined on blockchain.</p>
                  ) : (
                    milestones.map((milestone) => (
                      <div key={milestone.id} className="milestone-card blockchain">
                        <h4>Milestone {milestone.id + 1}: {milestone.description}</h4>
                        <p><strong>Target:</strong> {milestone.targetValue}</p>
                        <p><strong>Achieved:</strong> {milestone.achievedValue}</p>
                        <p><strong>Payout:</strong> {milestone.payoutAmount} USDC</p>
                        <p><strong>Status:</strong> 
                          <span className={`status-badge ${milestone.isCompleted ? 'completed' : 'pending'}`}>
                            {milestone.isCompleted ? 'Completed' : 'Pending'}
                          </span>
                        </p>
                        {!milestone.isCompleted && milestone.achievedValue >= milestone.targetValue && (
                          <button
                            onClick={() => handleTriggerDisbursement(milestone.id)}
                            disabled={isTriggeringDisbursement}
                            className="disburse-btn"
                          >
                            {isTriggeringDisbursement ? 'Disbursing...' : 'Trigger Disbursement'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Database Milestones */}
              <div className="milestones-section">
                <h3>Database Milestones (Historical)</h3>
                <div className="milestones-grid">
                  {dbMilestones.length === 0 ? (
                    <p>No milestone events recorded in database yet.</p>
                  ) : (
                    dbMilestones
                      .filter(event => event.eventType === 'MilestoneProgressUpdated')
                      .map((event, index) => (
                        <div key={index} className="milestone-card database">
                          <h4>Milestone Update Event</h4>
                          <p><strong>Milestone ID:</strong> {event.data?.milestoneId}</p>
                          <p><strong>New Progress:</strong> {event.data?.newProgress}</p>
                          <p><strong>Previous Progress:</strong> {event.data?.previousProgress || 'N/A'}</p>
                          <p><strong>Updated By:</strong> {event.userAddress}</p>
                          <p><strong>Timestamp:</strong> {new Date(event.timestamp).toLocaleString()}</p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </section>

            {/* Database Projects Section */}
            <section id="database-projects" className="database-projects card-section">
              <h2>Database Projects</h2>
              <div className="projects-grid">
                {dbProjects.length === 0 ? (
                  <p>No projects found in database yet.</p>
                ) : (
                  dbProjects.map((project, index) => (
                    <div key={index} className="project-card">
                      <div className="project-header">
                        <h3>{project.name}</h3>
                        <span className={`project-status ${project.status}`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="project-description">{project.description}</p>
                      <div className="project-details">
                        <p><strong>Project ID:</strong> {project.projectId}</p>
                        <p><strong>Owner:</strong> {project.owner}</p>
                        <p><strong>Total Subsidy:</strong> ₹{(project.totalSubsidy / 100000).toFixed(2)} Lakhs</p>
                        <p><strong>Disbursed:</strong> ₹{(project.disbursedAmount / 100000).toFixed(2)} Lakhs</p>
                      </div>
                      
                      {project.milestones && project.milestones.length > 0 && (
                        <div className="project-milestones">
                          <h4>Milestones:</h4>
                          {project.milestones.map((milestone, mIndex) => (
                            <div key={mIndex} className="milestone-item">
                              <p><strong>{milestone.description}</strong></p>
                              <p>Target: {milestone.targetValue} | Achieved: {milestone.achievedValue}</p>
                              <p>Payout: ₹{(milestone.payoutAmount / 100000).toFixed(2)} Lakhs</p>
                              <span className={`milestone-status ${milestone.isCompleted ? 'completed' : 'pending'}`}>
                                {milestone.isCompleted ? '✅ Completed' : '⏳ Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {project.attachments && project.attachments.length > 0 && (
                        <div className="project-attachments">
                          <h4>Attachments:</h4>
                          {project.attachments.map((attachment, aIndex) => (
                            <div key={aIndex} className="attachment-item">
                              <span>📎 {attachment.filename}</span>
                              <span className="attachment-date">
                                {new Date(attachment.uploadDate).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section id="event-log" className="event-log card-section">
              <h2>Event Log (Audit Trail)</h2>
              
              {/* Blockchain Events */}
              <div className="events-section">
                <h3>Blockchain Events (Real-time)</h3>
                <div className="event-items">
                  {events.length === 0 ? (
                    <p>No blockchain events recorded yet.</p>
                  ) : (
                    events.map((event, index) => (
                      <div key={index} className="event-item blockchain">
                        <p><strong>Type:</strong> {event.type}</p>
                        <p><strong>Data:</strong> {JSON.stringify(event.data)}</p>
                        <p><strong>Timestamp:</strong> {event.timestamp}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Database Events */}
              <div className="events-section">
                <h3>Database Events (Historical)</h3>
                <div className="event-items">
                  {dbEvents.length === 0 ? (
                    <p>No events recorded in database yet.</p>
                  ) : (
                    dbEvents.map((event, index) => (
                      <div key={index} className="event-item database">
                        <div className="event-header">
                          <span className={`event-type-badge ${event.eventType}`}>
                            {event.eventType}
                          </span>
                          <span className="event-timestamp">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="event-details">
                          <p><strong>Contract:</strong> {event.contractAddress}</p>
                          <p><strong>User:</strong> {event.userAddress}</p>
                          <p><strong>Data:</strong></p>
                          <div className="event-data">
                            <pre>{JSON.stringify(event.data, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        ) : (
          <p className="connect-wallet-message">Please connect your wallet to interact with the DApp.</p>
        )}
      </main>
    </div>
  );
}

export default App;
