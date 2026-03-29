I want you to build an app with both a web and mobile portal and an AI backend that will assist users with the process of selling their house. 
It will help them with pricing based on their current location and nearby sales (comps), marketing suggestions, best listing day(s), contract drafting (with disclaimers) and any other relevant input.
The AI should be able to tell the seller which rooms to paint and give suggestions on what improvememnts to do to improve chances of selling. Most bang for the buck. 
It could also suggest which pictures and features to highlight and create a flyer using pictures supplied by the owner.

Can you draft a full specification for Codex to make this happen? I want to use this as exposure for Workside Software only at this time.

I want auth to be email/password plus OTP verification.
Very comfortable with MongoDB Atlas for the backend.
For the web portal I am okay with Next.js in JavaScript.
No data source in mind for comps. 
I will give you the backend AI code from another project so you can get an idea of what we currently use. I will place in C:\Users\sjroy\Source\HomeAdvisor\legacy-merxus-ai-backend

RentCast API Key
WorksideHomeAdvisor
28d28686274d4944be93e704d89e677b


STRIPE_PRICE_ID_SELLER_UNLOCK
STRIPE_PRICE_ID_SELLER_PRO
STRIPE_PRICE_ID_AGENT_STARTER
STRIPE_PRICE_ID_AGENT_PRO
STRIPE_PRICE_ID_AGENT_TEAM

Suggested mapping:

STRIPE_PRICE_ID_SELLER_UNLOCK
Product: Workside Home Advisor Seller
Price: one-time
STRIPE_PRICE_ID_SELLER_PRO
Product: Workside Home Advisor Seller
Price: recurring monthly
STRIPE_PRICE_ID_AGENT_STARTER
Product: Workside Home Advisor Agent
Price: recurring monthly
STRIPE_PRICE_ID_AGENT_PRO
Product: Workside Home Advisor Agent
Price: recurring monthly
STRIPE_PRICE_ID_AGENT_TEAM
Product: Workside Home Advisor Agent
Price: recurring monthly
A practical first pass:

seller_unlock: one-time, maybe $49
agent_starter: monthly, maybe $49
agent_pro: monthly, maybe $99
agent_team: monthly, maybe $199