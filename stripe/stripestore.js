const axios = require('axios');
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_KEY);

let allCustomers;

router.get('/get-stripe-customers', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }

    try {
        allCustomers = await getAllCustomers();
        res.status(200).send('Got customers');
    } catch(error) {
        console.error('Failed to fetch customers:', error);
        res.status(500).send({ error: 'Failed to fetch customers' });
    }    
});

router.get('/get-stripe-active-subs', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { 
        res.status(401).json({error:"not logged in"}); 
        return; 
    }
    if (allCustomers == undefined || allCustomers == null) { 
        res.status(500).json({error:"no customer data"}); 
        return; 
    }

    try {
        //const getAllCustResp = await getAllCustomers();
        const categorizedSubscribers = await filterSubscriptions(allCustomers);
        res.send(categorizedSubscribers);
    } catch (error) {
        console.error('Failed to fetch active subscribers:', error);
        res.status(500).send({ error: 'Failed to fetch active subscribers' });
    }
});

async function getAllCustomers() {
    let allCustomers = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
            params.starting_after = startingAfter;
        }

        const customersBatch = await stripe.customers.list(params);

        allCustomers = allCustomers.concat(customersBatch.data);
        hasMore = customersBatch.has_more;

        if (hasMore) {
            startingAfter = customersBatch.data[customersBatch.data.length - 1].id;
        }
    }

    console.log(`Got all customers:${allCustomers.length}`);
    return allCustomers;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function filterSubscriptions(customers) {
    let categorizedSubscribers = {
        nonSub: [],
        active: [],
        canceled: [],
        incomplete: [],
        incomplete_expired: [],
        past_due: [],
        unpaid: [],
        paused: [],
        activeTrial: [],
        inactiveTrial: []
    };

    // Helper function to categorize subscription status
    const categorizeSubscription = async (customer) => {
        try {
            const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                limit: 1
            });

            if (subscriptions.data.length === 0) {
                categorizedSubscribers.nonSub.push(customer);
                return;
            }
            // Sort subscriptions by created date, newest first if not already sorted by the API
            subscriptions.data.sort((a, b) => b.created - a.created);

            // Find the most recent relevant subscription
            for (const subscription of subscriptions.data) {
                // Handle other statuses
                switch (subscription.status) {
                    case 'active':
                        categorizedSubscribers.active.push(customer);
                        break; // Stop processing further as the most recent status has been found
                    case 'canceled':
                        categorizedSubscribers.canceled.push(customer);
                        break;
                    case 'incomplete':
                        categorizedSubscribers.incomplete.push(customer);
                        break;
                    case 'incomplete_expired':
                        categorizedSubscribers.incomplete_expired.push(customer);
                        break;
                    case 'past_due':
                        categorizedSubscribers.past_due.push(customer);
                        break;
                    case 'unpaid':
                        categorizedSubscribers.unpaid.push(customer);
                        break;
                    case 'paused':
                        categorizedSubscribers.paused.push(customer);
                        break;
                    case 'trialing':
                        const now = new Date();
                        if (new Date(subscription.trial_end * 1000) > now) {
                            categorizedSubscribers.activeTrial.push(customer);
                        } else {
                            categorizedSubscribers.inactiveTrial.push(customer);
                        }
                        break;
                    default:
                        categorizedSubscribers.canceled.push(customer);
                        break;
                }
            }
        } catch (error) {
            console.error(`Error fetching subscriptions for customer ${customer.id}:`, error);
        }
    };

    // Split customers into chunks to manage parallel calls without overwhelming the Stripe API
    const chunkSize = 100;
    for (let i = 0; i < customers.length; i += chunkSize) {
        const customerChunk = customers.slice(i, i + chunkSize);
        const promises = customerChunk.map(categorizeSubscription);
        await Promise.all(promises);

        if (i + chunkSize < customers.length) {
            await delay(50);
        }
    }

    console.log(`Subscription categorization complete: 
      Active: ${categorizedSubscribers.active.length},
      Canceled: ${categorizedSubscribers.canceled.length},
      Active Trial: ${categorizedSubscribers.activeTrial.length},
      Inactive Trial: ${categorizedSubscribers.inactiveTrial.length}
      Non Subs: ${categorizedSubscribers.nonSub.length}`);

    let pastDudeUnpaid = parseInt(categorizedSubscribers.past_due.length)+parseInt(categorizedSubscribers.unpaid.length)
    let output = {
        totalActiveSubs: categorizedSubscribers.active.length,
        totalActiveTrials: categorizedSubscribers.activeTrial.length,
        totalPastDueUnpaid: pastDudeUnpaid,
        totalNonSubs: categorizedSubscribers.nonSub.length
    }
    return output;
}


module.exports = router;