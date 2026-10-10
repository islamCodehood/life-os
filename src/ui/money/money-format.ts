// Display-only money formatting. Business calculations always use bigint minor units.
export function currencyDecimals(currency:string){
 try{return new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;}
 catch{return 2;}
}
export function toMinorUnits(raw:string,currency:string):string{
 const digits=currencyDecimals(currency);
 if(!/^\d+(\.\d+)?$/.test(raw.trim()))throw new Error('Invalid decimal money input.');
 const [whole,minor='']=raw.trim().split('.');
 if(minor.length>digits)throw new Error('Too many decimal places.');
 return (BigInt(whole)*10n**BigInt(digits)+BigInt(minor.padEnd(digits,'0')||'0')).toString();
}
export function displayMoney(minor:string,currency:string,locale:string){
 const digits=currencyDecimals(currency);
 const value=BigInt(minor);
 const pow=10n**BigInt(digits);
 const whole=value/pow;
 const part=(value%pow).toString().padStart(digits,'0');
 const decimal=digits===0?whole.toString():whole.toString()+'.'+part;
 return `${decimal} ${currency}`;
}
export function suggestedSplit(unallocated:string){
 const amount=BigInt(unallocated);
 const give=amount*20n/100n;
 const save=amount*60n/100n;
 const spend=amount-give-save;
 return {giveMinor:give.toString(),saveMinor:save.toString(),spendMinor:spend.toString()};
}
