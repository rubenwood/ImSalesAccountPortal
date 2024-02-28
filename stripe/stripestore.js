const axios = require('axios');
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_KEY);

router.get('/get-stripe-customers', async (req, res) => {
    try{
        const allCustomers = await getAllCustomers();
        res.send(allCustomers);
    } catch(error) {
        console.error('Failed to fetch customers:', error);
        res.status(500).send({ error: 'Failed to fetch customers' });
    }
    
});

router.get('/get-stripe-active-subs', async (req, res) => {
    try {
        const allCustomers = await getAllCustomers();
        const activeSubscribers = await filterActiveSubscribers(allCustomers);
        console.log(activeSubscribers.length);
        res.send(activeSubscribers);
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
        const params = { limit: 100 }; // You can adjust the limit up to a maximum of 100 per request
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
    return allCustomers; // Return the compiled list of all customers
}

async function filterActiveSubscribers(customers) {
    let activeSubscribers = [];

    for (const customer of customers) {
        try {
            // Fetch subscriptions for the current customer
            const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'active', // Filter by 'active' status to reduce processing
                limit: 1 // We only need to know if there is at least one active subscription
            });

            // If the customer has one or more active subscriptions, add them to the list
            if (subscriptions.data.length > 0) {
                activeSubscribers.push(customer);
            }
        } catch (error) {
            console.error(`Error fetching subscriptions for customer ${customer.id}:`, error);
            // Depending on your error handling, you might want to throw the error, return it, or log it
        }
    }
    console.log(`Got all active subs:${activeSubscribers.length}`);
    return activeSubscribers;
}


module.exports = router;