import { Fragment, useState, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { SocialCard } from './SocialCard'

export default function NftModal({ onClose, airstack, address, count, contractsInCommon }) {
  const [open, setOpen] = useState(true);

  // Memoize contracts list - this is a synchronous transform, no need for useEffect
  const contractsList = useMemo(() => {
    return Object.values(contractsInCommon || {}).map(item => item.name);
  }, [contractsInCommon]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose} static>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-60"
          leave="ease-in duration-200"
          leaveFrom="opacity-60"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-800/5  transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-60 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-60 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
              <SocialCard airstack={airstack} address={address} count={count} inModal={true}/>
               <div className="text-gray-700 px-4 py-5 sm:px-6">
                  <h2 className='pb-2'>You have <span className='font-semibold'>{count}</span> collections in common</h2>
                  <ul>
                    {contractsList.map((contract, i) => (
                      <li key={contract+i} className="flex justify-between items-center align-middle pt-1">
                        <div className='text-xs'>
                        {contract}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}


 